import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FlowMode,
  Prisma,
  RequestStatus,
  SignatureStatus,
  TaskAction,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  FlowStatusDto,
  FlowStepStatusView,
  FlowTaskView,
} from './dto/flow-status.dto';

/** A FlowStep loaded with its assignees (engine working shape). */
type StepWithAssignees = Prisma.FlowStepGetPayload<{
  include: { assignees: true };
}>;

/**
 * Drives the approval workflow.
 *
 * Steps run in `order` sequence. Within a step:
 *  - PARALLEL  → every assignee gets a task at once; the step completes when
 *               ALL assignees have acted (and none are cancelled).
 *  - SEQUENTIAL→ assignees act one at a time by `order`; the next task is only
 *               created once the previous assignee acts; the step completes
 *               when everyone in it has acted.
 * When a step completes the engine advances to the next step; when the last
 * step completes the request is APPROVED. A REJECT ends the flow immediately.
 *
 * Each task is the "action" created for an assignee, carrying their own duty
 * (APPROVAL or ACTION) copied from FlowAssignee.type.
 */
@Injectable()
export class ApprovalEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Instantiate the requester's own flow (built when they created the
   * request — see RequestService.create) and activate its first step. If
   * the request was submitted without a flow, it is auto-approved.
   */
  async startFlow(responseId: string, flowId?: string): Promise<void> {
    const flow = flowId
      ? await this.prisma.flow.findUnique({
          where: { id: flowId },
          include: {
            steps: { orderBy: { order: 'asc' }, include: { assignees: true } },
          },
        })
      : null;

    if (!flow || flow.steps.length === 0) {
      await this.prisma.formResponse.update({
        where: { id: responseId },
        data: { status: RequestStatus.APPROVED },
      });
      return;
    }

    const firstStep = flow.steps[0];
    const instance = await this.prisma.flowInstance.create({
      data: { flowId: flow.id, responseId, currentStep: firstStep.order },
    });
    await this.activateStep(instance.id, firstStep);
    await this.prisma.formResponse.update({
      where: { id: responseId },
      data: { status: RequestStatus.PENDING },
    });
  }

  /**
   * Resume a carried (reserve-cloned) flow: reopen the step where changes were
   * requested so the flow continues from there, keeping every earlier approval.
   * On the current step, tasks that were REQUEST_CHANGES'd or cancelled are set
   * back to PENDING (action cleared); already-approved (DONE) tasks are left
   * untouched. The reopened approvers' signature boxes are reset so they re-sign.
   * Finally the request returns to PENDING. Used by RequestService.submitDraft.
   */
  async reopenCurrentStep(responseId: string): Promise<void> {
    const instance = await this.prisma.flowInstance.findUnique({
      where: { responseId },
      include: {
        tasks: true,
        flow: { include: { steps: { select: { id: true, order: true } } } },
      },
    });
    if (!instance) {
      throw new BadRequestException('This request has no approval flow');
    }

    // The step the flow paused on (where changes were requested / pulled back).
    const currentStep = instance.flow.steps.find(
      (s) => s.order === instance.currentStep,
    );
    if (!currentStep) {
      throw new BadRequestException('Flow is in an inconsistent state');
    }

    // Reopen that step's tasks that were sent back: the REQUEST_CHANGES'd task
    // (DONE with that action) plus any siblings cancelled when it paused. Tasks
    // already approved (DONE / APPROVE | COMPLETE) keep their approval.
    const toReopen = instance.tasks.filter(
      (t) =>
        t.stepId === currentStep.id &&
        (t.status === TaskStatus.CANCELLED ||
          t.action === TaskAction.REQUEST_CHANGES),
    );
    const reopenedUserIds = [...new Set(toReopen.map((t) => t.assigneeId))];

    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { id: { in: toReopen.map((t) => t.id) } },
        data: { status: TaskStatus.PENDING, action: null, actedAt: null },
      });
      if (reopenedUserIds.length) {
        // Re-pend the reopened approvers' signature boxes so they re-sign.
        await tx.signatureField.updateMany({
          where: { responseId, assigneeId: { in: reopenedUserIds } },
          data: {
            status: SignatureStatus.PENDING,
            signatureName: null,
            signatureImage: null,
            signedAt: null,
          },
        });
      }
      await tx.flowInstance.update({
        where: { id: instance.id },
        data: { isDone: false },
      });
      await tx.formResponse.update({
        where: { id: responseId },
        data: { status: RequestStatus.PENDING },
      });
    });
  }

  /**
   * Apply an assignee's action to their pending task on the current step and
   * advance the flow as needed.
   */
  async act(
    userId: string,
    responseId: string,
    action: TaskAction,
  ): Promise<FlowStatusDto> {
    const instance = await this.prisma.flowInstance.findUnique({
      where: { responseId },
      include: {
        tasks: true,
        response: { select: { status: true } },
        flow: {
          include: {
            steps: { orderBy: { order: 'asc' }, include: { assignees: true } },
          },
        },
      },
    });
    if (!instance) {
      throw new NotFoundException('This request has no approval flow');
    }
    if (instance.isDone) {
      throw new BadRequestException('Approval flow already finished');
    }
    // A carried (reserve-cloned) draft holds a flow instance but must not be
    // actionable until the requestor confirms it (submitDraft → resume).
    if (instance.response.status === RequestStatus.DRAFT) {
      throw new BadRequestException('This request has not been submitted yet');
    }

    const currentStep = instance.flow.steps.find(
      (s) => s.order === instance.currentStep,
    );
    if (!currentStep) {
      throw new BadRequestException('Flow is in an inconsistent state');
    }

    const task = instance.tasks.find(
      (t) =>
        t.stepId === currentStep.id &&
        t.assigneeId === userId &&
        t.status === TaskStatus.PENDING,
    );
    if (!task) {
      throw new ForbiddenException('You have no pending task on this request');
    }

    // Signing constraint: an approver can only APPROVE once every signature box
    // assigned to them has been signed (the document is signed via the
    // dedicated /signature/sign endpoint, which signs then calls this).
    if (action === TaskAction.APPROVE && task.type === TaskType.APPROVAL) {
      const fields = await this.prisma.signatureField.findMany({
        where: { responseId, assigneeId: userId },
        select: { status: true },
      });
      if (
        fields.length > 0 &&
        fields.some((f) => f.status !== SignatureStatus.SIGNED)
      ) {
        throw new BadRequestException('Sign the document before approving');
      }
    }

    // FORWARD reassigns a task and has its own dedicated endpoint.
    if (action === TaskAction.FORWARD) {
      throw new BadRequestException(`Use the dedicated endpoint for ${action}`);
    }

    await this.prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.DONE, action, actedAt: new Date() },
    });

    // REQUEST_CHANGES: the approver hands the request back to the requestor.
    // The flow pauses (not finished) and the request enters REQUEST_CHANGES;
    // the requestor then either edits + resubmits or revises (clones). Any
    // sibling tasks still pending on this step are cancelled.
    if (action === TaskAction.REQUEST_CHANGES) {
      await this.prisma.task.updateMany({
        where: { instanceId: instance.id, status: TaskStatus.PENDING },
        data: { status: TaskStatus.CANCELLED },
      });
      await this.prisma.formResponse.update({
        where: { id: responseId },
        data: { status: RequestStatus.REQUEST_CHANGES },
      });
      return this.getStatus(responseId);
    }

    // Terminal rejection: cancel everything pending and reject the request.
    if (action === TaskAction.REJECT || action === TaskAction.CANCEL) {
      await this.prisma.task.updateMany({
        where: { instanceId: instance.id, status: TaskStatus.PENDING },
        data: { status: TaskStatus.CANCELLED },
      });
      await this.prisma.flowInstance.update({
        where: { id: instance.id },
        data: { isDone: true },
      });
      await this.prisma.formResponse.update({
        where: { id: responseId },
        data: {
          status:
            action === TaskAction.CANCEL
              ? RequestStatus.CANCELLED
              : RequestStatus.REJECTED,
        },
      });
      return this.getStatus(responseId);
    }

    const assignees = this.sortedAssignees(currentStep);
    const stepTasks = await this.prisma.task.findMany({
      where: { instanceId: instance.id, stepId: currentStep.id },
    });

    // SEQUENTIAL: hand off to the next assignee who has no task yet.
    if (currentStep.mode === FlowMode.SEQUENTIAL) {
      const assigned = new Set(stepTasks.map((t) => t.assigneeId));
      const next = assignees.find((a) => !assigned.has(a.userId));
      if (next) {
        await this.prisma.task.create({
          data: {
            instanceId: instance.id,
            stepId: currentStep.id,
            assigneeId: next.userId,
            type: next.type,
            status: TaskStatus.PENDING,
          },
        });
        return this.getStatus(responseId);
      }
    }

    // Step is complete only when every assignee has a DONE task.
    const doneUsers = new Set(
      stepTasks
        .filter((t) => t.status === TaskStatus.DONE)
        .map((t) => t.assigneeId),
    );
    const stepComplete = assignees.every((a) => doneUsers.has(a.userId));
    if (!stepComplete) {
      return this.getStatus(responseId); // PARALLEL: still waiting on others
    }

    // Advance to the next step, or finish the flow.
    const nextStep = instance.flow.steps.find(
      (s) => s.order > instance.currentStep,
    );
    if (nextStep) {
      await this.prisma.flowInstance.update({
        where: { id: instance.id },
        data: { currentStep: nextStep.order },
      });
      await this.activateStep(instance.id, nextStep);
    } else {
      await this.prisma.flowInstance.update({
        where: { id: instance.id },
        data: { isDone: true },
      });
      await this.prisma.formResponse.update({
        where: { id: responseId },
        data: { status: RequestStatus.APPROVED },
      });
    }
    return this.getStatus(responseId);
  }

  /**
   * FORWARD: reassign the caller's pending task on the current step to another
   * user, keeping the flow position. Also updates the step blueprint so the
   * planned flow reflects the new approver.
   */
  async forward(
    userId: string,
    responseId: string,
    toUserId: string,
  ): Promise<FlowStatusDto> {
    if (userId === toUserId) {
      throw new BadRequestException('Cannot forward to yourself');
    }

    const instance = await this.prisma.flowInstance.findUnique({
      where: { responseId },
      include: {
        tasks: { include: { step: true } },
        flow: {
          include: {
            steps: { orderBy: { order: 'asc' }, include: { assignees: true } },
          },
        },
      },
    });
    if (!instance) {
      throw new NotFoundException('This request has no approval flow');
    }
    if (instance.isDone) {
      throw new BadRequestException('Approval flow already finished');
    }

    const currentStep = instance.flow.steps.find(
      (s) => s.order === instance.currentStep,
    );
    if (!currentStep) {
      throw new BadRequestException('Flow is in an inconsistent state');
    }

    const task = instance.tasks.find(
      (t) =>
        t.stepId === currentStep.id &&
        t.assigneeId === userId &&
        t.status === TaskStatus.PENDING,
    );
    if (!task) {
      throw new ForbiddenException('You have no pending task on this request');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: toUserId },
    });
    if (!target || !target.isActive) {
      throw new BadRequestException('Forward target is not a valid user');
    }

    await this.prisma.$transaction([
      this.prisma.task.update({
        where: { id: task.id },
        data: { assigneeId: toUserId },
      }),
      // Keep the blueprint consistent with the reassignment.
      this.prisma.flowAssignee.updateMany({
        where: { stepId: currentStep.id, userId },
        data: { userId: toUserId },
      }),
    ]);

    return this.getStatus(responseId);
  }

  /** Status snapshot for a request (get-by-requestId). */
  async getStatus(responseId: string): Promise<FlowStatusDto> {
    const response = await this.prisma.formResponse.findUnique({
      where: { id: responseId },
    });
    if (!response) {
      throw new NotFoundException('Request not found');
    }

    const instance = await this.prisma.flowInstance.findUnique({
      where: { responseId },
      include: {
        tasks: { include: { assignee: true, step: true } },
        flow: {
          include: {
            steps: {
              orderBy: { order: 'asc' },
              include: { assignees: { include: { user: true } } },
            },
          },
        },
      },
    });

    if (!instance) {
      return {
        requestId: responseId,
        requestStatus: response.status,
        hasFlow: false,
        isDone: false,
        currentStep: null,
        tasks: [],
        steps: [],
      };
    }

    const tasks: FlowTaskView[] = instance.tasks
      .map((t) => ({
        id: t.id,
        stepOrder: t.step.order,
        stepMode: t.step.mode,
        assignee: {
          id: t.assignee.id,
          email: t.assignee.email,
          displayName: t.assignee.displayName,
        },
        type: t.type,
        status: t.status,
        action: t.action,
        actedAt: t.actedAt,
      }))
      .sort((a, b) => a.stepOrder - b.stepOrder);

    // Blueprint: every step + assignee, merged with their task state (if any).
    const steps: FlowStepStatusView[] = instance.flow.steps.map((step) => ({
      order: step.order,
      mode: step.mode,
      name: step.name,
      isFinal: step.isFinal,
      required: step.required,
      isCurrent: !instance.isDone && instance.currentStep === step.order,
      assignees: this.sortedAssignees(step).map((a) => {
        const task = instance.tasks.find(
          (t) => t.stepId === step.id && t.assigneeId === a.userId,
        );
        return {
          id: a.user.id,
          email: a.user.email,
          displayName: a.user.displayName,
          type: a.type,
          order: a.order,
          status: task?.status ?? null,
          action: task?.action ?? null,
          actedAt: task?.actedAt ?? null,
        };
      }),
    }));

    return {
      requestId: responseId,
      requestStatus: response.status,
      hasFlow: true,
      isDone: instance.isDone,
      currentStep: instance.isDone ? null : instance.currentStep,
      tasks,
      steps,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async activateStep(
    instanceId: string,
    step: StepWithAssignees,
  ): Promise<void> {
    const assignees = this.sortedAssignees(step);
    if (assignees.length === 0) return;

    if (step.mode === FlowMode.PARALLEL) {
      await this.prisma.task.createMany({
        data: assignees.map((a) => ({
          instanceId,
          stepId: step.id,
          assigneeId: a.userId,
          type: a.type,
          status: TaskStatus.PENDING,
        })),
      });
    } else {
      const first = assignees[0];
      await this.prisma.task.create({
        data: {
          instanceId,
          stepId: step.id,
          assigneeId: first.userId,
          type: first.type,
          status: TaskStatus.PENDING,
        },
      });
    }
  }

  private sortedAssignees<T extends { order: number | null }>(step: {
    assignees: T[];
  }): T[] {
    return [...step.assignees].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}

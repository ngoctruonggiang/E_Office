import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  RequestStatus,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';
import { buildMeta, toSkipTake } from '../../core/common/utils/pagination.util';
import { ApprovalEngineService } from '../approval-flow/approval-engine.service';
import { SignatureService } from '../signature/signature.service';
import { ApprovalActionDto } from '../approval-flow/dto/approval-action.dto';
import { CreateFlowStepInput } from '../approval-flow/dto/create-flow.dto';
import { FlowStatusDto } from '../approval-flow/dto/flow-status.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { SubmitDraftDto } from './dto/submit-draft.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import {
  RequestDetailDto,
  RequestSummaryDto,
} from './dto/request-response.dto';
import { validateRequestValues } from '../form-builder/validators/form-value.validator';
import { OperatonClientService } from '../operaton/operaton-client.service';
import { BpmnParserService } from '../operaton/bpmn-parser.service';
import { FlowSimulationService, FlowSimulationResult } from './flow-simulation.service';
import { ActorResolverService } from '../procedure/actor-resolver.service';
import { CreateRequestFromProcedureDto } from './dto/create-request-from-procedure.dto';
import { ActualActorItemDto } from './dto/update-actual-actors.dto';
import { DutyQueryDto } from './dto/duty-query.dto';
import { SignAndApproveDto } from './dto/sign-and-approve.dto';
import { ResubmitRequestDto } from './dto/resubmit-request.dto';
import { CloneProcedureRequestDto } from './dto/clone-procedure-request.dto';

/** Include used to build a request summary (form id/name + version). */
const summaryInclude = {
  formVersion: {
    select: { version: true, form: { select: { id: true, name: true } } },
  },
  procedureVersion: {
    select: {
      id: true,
      version: true,
      procedure: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.FormResponseInclude;

type SummaryRow = Prisma.FormResponseGetPayload<{
  include: typeof summaryInclude;
}>;

/** A duty row = the caller's task joined to its request summary. */
const dutyInclude = {
  instance: { include: { response: { include: summaryInclude } } },
} satisfies Prisma.TaskInclude;

type DutyRow = Prisma.TaskGetPayload<{ include: typeof dutyInclude }>;

/**
 * Coerce a date-only string ("2026-12-31") to the end of that day so a
 * createdTo upper bound is inclusive of the whole day; full timestamps are
 * used as-is.
 */
function endOfDayIfDateOnly(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }
  return new Date(value);
}

@Injectable()
export class RequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ApprovalEngineService,
    private readonly operatonClient: OperatonClientService,
    private readonly bpmnParser: BpmnParserService,
    private readonly flowSimulation: FlowSimulationService,
    private readonly actorResolver: ActorResolverService,
  ) { }

  /**
   * Create a request (EAV values), optionally submitting it to the approval
   * flow the requester built for it (`dto.steps`) — there is no fixed flow
   * tied to the form.
   */
  async create(
    userId: string,
    dto: CreateRequestDto,
  ): Promise<RequestDetailDto> {
    const version = await this.prisma.formVersion.findFirst({
      where: { formId: dto.formId },
      orderBy: { version: 'desc' },
      include: {
        fields: { include: { options: true, validations: true } },
      },
    });
    if (!version) {
      throw new NotFoundException('Form not found');
    }

    const mode = dto.submit !== false ? 'strict' : 'draft';
    const { sanitizedEntries } = validateRequestValues({
      fields: version.fields,
      layoutSchema: version.layoutSchema,
      entries: dto.values,
      mode,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const response = await tx.formResponse.create({
        data: {
          formVersionId: version.id,
          createdById: userId,
          status: RequestStatus.DRAFT,
        },
      });
      if (sanitizedEntries.length) {
        await tx.formResponseValue.createMany({
          data: sanitizedEntries.map((v) => ({
            responseId: response.id,
            fieldKey: v.fieldKey,
            value: v.value as Prisma.InputJsonValue,
          })),
        });
      }
      if (dto.viewerIds?.length) {
        await tx.requestViewer.createMany({
          data: dto.viewerIds.map((uid) => ({
            responseId: response.id,
            userId: uid,
          })),
          skipDuplicates: true,
        });
      }

      await this.validateSignatureCoverage(tx, response.id, dto.steps);
      const flowId = await this.buildFlow(tx, response.id, dto);

      return { responseId: response.id, flowId };
    });

    // Submit by default — kicks off the requester's own flow, if they built one.
    if (dto.submit !== false) {
      await this.engine.startFlow(created.responseId, created.flowId);
    }
    return this.getOne(created.responseId);
  }

  /** Update only the field values; creator-only, while still editable. */
  async update(
    userId: string,
    id: string,
    dto: UpdateRequestDto,
  ): Promise<RequestDetailDto> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id },
      include: {
        values: true,
        formVersion: {
          include: {
            fields: { include: { options: true, validations: true } },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('You can only edit your own requests');
    }
    // Values are editable in "craft mode" (DRAFT) or when an approver has
    // sent the request back for modifications (REQUEST_CHANGES).
    if (
      request.status !== RequestStatus.DRAFT &&
      request.status !== RequestStatus.REQUEST_CHANGES
    ) {
      throw new BadRequestException(
        'Only a draft or revision-pending request can be edited',
      );
    }

    const mergedMap = new Map<string, unknown>(
      request.values.map((v) => [v.fieldKey, v.value]),
    );
    for (const v of dto.values) {
      mergedMap.set(v.fieldKey, v.value);
    }
    const { sanitizedEntries } = validateRequestValues({
      fields: request.formVersion.fields,
      layoutSchema: request.formVersion.layoutSchema,
      entries: Array.from(mergedMap.entries()).map(([fieldKey, value]) => ({
        fieldKey,
        value,
      })),
      mode: 'draft',
    });

    const sanitizedMap = new Map(
      sanitizedEntries.map((e) => [e.fieldKey, e.value]),
    );
    const keysToUpsert = new Set([
      ...dto.values.map((v) => v.fieldKey),
      ...sanitizedEntries.map((e) => e.fieldKey),
    ]);

    for (const fieldKey of keysToUpsert) {
      if (!sanitizedMap.has(fieldKey)) continue;
      const value = sanitizedMap.get(fieldKey);
      await this.prisma.formResponseValue.upsert({
        where: {
          responseId_fieldKey: { responseId: id, fieldKey },
        },
        create: {
          responseId: id,
          fieldKey,
          value: value as Prisma.InputJsonValue,
        },
        update: { value: value as Prisma.InputJsonValue },
      });
    }
    return this.getOne(id);
  }

  /**
   * clone-reserve: copy all field values AND the prior approval state (flow
   * instance + tasks with their statuses) so already-granted approvals carry
   * over.
   */
  cloneReserve(userId: string, id: string): Promise<RequestDetailDto> {
    return this.clone(userId, id, 'reserve');
  }

  /** clone-reset: copy all field values but start fresh (DRAFT, no approvals). */
  cloneReset(userId: string, id: string): Promise<RequestDetailDto> {
    return this.clone(userId, id, 'reset');
  }

  /** Approve / reject / act on a request (delegates to the flow engine). */
  approve(
    userId: string,
    id: string,
    dto: ApprovalActionDto,
  ): Promise<FlowStatusDto> {
    return this.engine.act(userId, id, dto.action);
  }

  /**
   * Revise (requestor-only): once an approver has set the request to
   * REQUEST_CHANGES, the requestor clones it (reset|reserve), the original
   * becomes CANCELLED, and the DRAFT clone — returned here — is finalized via
   * submitDraft. reset → the flow may be edited then rebuilt; reserve → the
   * flow is carried with its approvals and resumed from the change step.
   */
  async revise(
    userId: string,
    id: string,
    mode: 'reset' | 'reserve',
  ): Promise<RequestDetailDto> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Only the requestor can revise this request');
    }
    if (request.status !== RequestStatus.REQUEST_CHANGES) {
      throw new BadRequestException(
        'A request can only be revised after changes are requested',
      );
    }

    const clone = await this.prisma.$transaction(async (tx) => {
      // Clone first (reserve copies the original's CURRENT sign state), then
      // reject the original's still-pending signature boxes for its remaining
      // assignees and cancel the original request.
      const created = await this.cloneWithin(tx, userId, id, mode);
      await SignatureService.rejectPending(tx, id);
      await tx.formResponse.update({
        where: { id },
        data: { status: RequestStatus.CANCELLED },
      });
      return created;
    });

    return this.getOne(clone.id);
  }

  /**
   * Submit a DRAFT request (requestor-only) — used to finalize a cloned draft
   * after editing its values/documents/flow. Replaces the viewers, (re)builds
   * the approval flow from the supplied steps, and starts it. With no steps the
   * request is auto-approved (same as create).
   */
  async submitDraft(
    userId: string,
    id: string,
    dto: SubmitDraftDto,
  ): Promise<any> {
    const check = await this.prisma.formResponse.findUnique({
      where: { id },
      select: { procedureVersionId: true },
    });
    if (check?.procedureVersionId) {
      return this.submitProcedureRequest(id, dto.values, userId);
    }

    const request = await this.prisma.formResponse.findUnique({
      where: { id },
      include: {
        flowInstance: true,
        values: true,
        formVersion: {
          include: {
            fields: { include: { options: true, validations: true } },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Only the requestor can submit this request');
    }
    if (request.status !== RequestStatus.DRAFT) {
      throw new BadRequestException('Only a draft request can be submitted');
    }

    const { sanitizedEntries, hiddenFieldKeys } = validateRequestValues({
      fields: request.formVersion.fields,
      layoutSchema: request.formVersion.layoutSchema,
      entries: request.values.map((v) => ({
        fieldKey: v.fieldKey,
        value: v.value,
      })),
      mode: 'strict',
    });

    // reserve clone: the flow was carried over with its approvals — don't rebuild
    // it. Just replace viewers and resume the flow from the change step.
    if (request.cloneMode === 'reserve' && request.flowInstance) {
      await this.prisma.$transaction(async (tx) => {
        if (hiddenFieldKeys.size > 0) {
          await tx.formResponseValue.deleteMany({
            where: { responseId: id, fieldKey: { in: [...hiddenFieldKeys] } },
          });
        }
        for (const entry of sanitizedEntries) {
          await tx.formResponseValue.upsert({
            where: { responseId_fieldKey: { responseId: id, fieldKey: entry.fieldKey } },
            create: {
              responseId: id,
              fieldKey: entry.fieldKey,
              value: entry.value as Prisma.InputJsonValue,
            },
            update: { value: entry.value as Prisma.InputJsonValue },
          });
        }
        await tx.requestViewer.deleteMany({ where: { responseId: id } });
        if (dto.viewerIds?.length) {
          await tx.requestViewer.createMany({
            data: dto.viewerIds.map((uid) => ({ responseId: id, userId: uid })),
            skipDuplicates: true,
          });
        }
      });
      await this.engine.reopenCurrentStep(id);
      return this.getOne(id);
    }

    const flowId = await this.prisma.$transaction(async (tx) => {
      if (hiddenFieldKeys.size > 0) {
        await tx.formResponseValue.deleteMany({
          where: { responseId: id, fieldKey: { in: [...hiddenFieldKeys] } },
        });
      }
      for (const entry of sanitizedEntries) {
        await tx.formResponseValue.upsert({
          where: { responseId_fieldKey: { responseId: id, fieldKey: entry.fieldKey } },
          create: {
            responseId: id,
            fieldKey: entry.fieldKey,
            value: entry.value as Prisma.InputJsonValue,
          },
          update: { value: entry.value as Prisma.InputJsonValue },
        });
      }
      // Discard any pre-existing (un-started) flow state, then replace viewers.
      if (request.flowInstance) {
        await tx.task.deleteMany({
          where: { instanceId: request.flowInstance.id },
        });
        await tx.flowInstance.delete({ where: { id: request.flowInstance.id } });
      }
      await tx.requestViewer.deleteMany({ where: { responseId: id } });
      if (dto.viewerIds?.length) {
        await tx.requestViewer.createMany({
          data: dto.viewerIds.map((uid) => ({ responseId: id, userId: uid })),
          skipDuplicates: true,
        });
      }
      await this.validateSignatureCoverage(tx, id, dto.steps);
      return this.buildFlow(tx, id, dto);
    });

    await this.engine.startFlow(id, flowId);
    return this.getOne(id);
  }

  /**
   * Cancel the request directly (requestor-only), independent of the flow —
   * valid while DRAFT / PENDING / REQUEST_CHANGES. Cancels any pending tasks
   * and marks the flow done.
   */
  async cancelByRequestor(userId: string, id: string): Promise<any> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id },
      include: { flowInstance: true },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.procedureVersionId) {
      return this.cancelProcedureRequest(id, undefined, userId);
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Only the requestor can cancel this request');
    }
    if (
      request.status !== RequestStatus.DRAFT &&
      request.status !== RequestStatus.PENDING &&
      request.status !== RequestStatus.REQUEST_CHANGES
    ) {
      throw new BadRequestException('A finalized request cannot be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      if (request.flowInstance) {
        await tx.task.updateMany({
          where: {
            instanceId: request.flowInstance.id,
            status: TaskStatus.PENDING,
          },
          data: { status: TaskStatus.CANCELLED },
        });
        await tx.flowInstance.update({
          where: { id: request.flowInstance.id },
          data: { isDone: true },
        });
      }
      await SignatureService.rejectPending(tx, id);
      await tx.formResponse.update({
        where: { id },
        data: { status: RequestStatus.CANCELLED },
      });
    });
    return this.getOne(id);
  }

  /**
   * Request changes on one's own request directly (requestor-only), independent
   * of the flow — pulls a PENDING request back to the requestor to revise. Sets
   * status REQUEST_CHANGES and cancels pending approver tasks (the flow pauses).
   */
  async requestChangesByRequestor(
    userId: string,
    id: string,
  ): Promise<RequestDetailDto> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id },
      include: { flowInstance: true },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException(
        'Only the requestor can request changes on this request',
      );
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending request can be pulled back for changes',
      );
    }

    if (request.flowInstance) {
      await this.prisma.task.updateMany({
        where: {
          instanceId: request.flowInstance.id,
          status: TaskStatus.PENDING,
        },
        data: { status: TaskStatus.CANCELLED },
      });
    }
    await this.prisma.formResponse.update({
      where: { id },
      data: { status: RequestStatus.REQUEST_CHANGES },
    });
    return this.getOne(id);
  }

  /**
   * Clone lineage: the chain of previous versions of this request, walking
   * `clonedFromId` back to the original, ordered oldest → newest (the current
   * request is the last entry). Lets the requestor/approvers open old versions.
   */
  async getHistory(id: string): Promise<RequestSummaryDto[]> {
    const chain: RequestSummaryDto[] = [];
    let cursor: string | null = id;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const row = await this.prisma.formResponse.findUnique({
        where: { id: cursor },
        include: summaryInclude,
      });
      if (!row) break;
      chain.push(this.toSummary(row));
      cursor = row.clonedFromId;
    }
    return chain.reverse();
  }

  /**
   * Add viewers to a request's viewable list. The requestor may add anyone; an
   * approval assignee may *share* the request by adding more viewers (they
   * cannot remove — see removeViewer). The creator is never added as a viewer.
   */
  async addViewers(
    userId: string,
    id: string,
    userIds: string[],
  ): Promise<RequestDetailDto> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    const isOwner = request.createdById === userId;
    if (!isOwner && !(await this.isApprovalAssignee(id, userId))) {
      throw new ForbiddenException(
        'Only the requestor or an approval assignee can add viewers',
      );
    }

    const toAdd = userIds.filter((uid) => uid !== request.createdById);
    if (toAdd.length) {
      await this.prisma.requestViewer.createMany({
        data: toAdd.map((uid) => ({ responseId: id, userId: uid })),
        skipDuplicates: true,
      });
    }
    return this.getOne(id);
  }

  /** Remove a viewer from the viewable list — requestor only. */
  async removeViewer(
    userId: string,
    id: string,
    targetUserId: string,
  ): Promise<RequestDetailDto> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Only the requestor can remove viewers');
    }
    await this.prisma.requestViewer.deleteMany({
      where: { responseId: id, userId: targetUserId },
    });
    return this.getOne(id);
  }

  /** FORWARD: reassign the caller's current task (delegates to the engine). */
  forward(
    userId: string,
    id: string,
    toUserId: string,
  ): Promise<FlowStatusDto> {
    return this.engine.forward(userId, id, toUserId);
  }

  /** Requests created by the current user, optionally filtered + paginated. */
  async getMine(
    userId: string,
    query: ListRequestsQueryDto,
  ): Promise<Paginated<RequestSummaryDto>> {
    // createdById is forced to the caller here, so the query's createdById
    // filter (if any) is intentionally ignored for this scope.
    return this.listRequests(
      { ...this.commonWhere(query), createdById: userId },
      query,
    );
  }

  /**
   * The caller's duties — one row per task assigned to them ("their duty"),
   * each carrying the request summary AND the duty's own status/action so the
   * list can show whether the duty is satisfied. Filterable by dutyStatus
   * (PENDING/DONE) and the shared request filters; sortable by duty/request
   * fields (default: newest duty first). Paginated at the task level so the
   * sort is correct across pages.
   *
   * The flow builder forbids a user from being an assignee on more than one
   * step, so in practice this is one duty per request.
   */
  async getByDuty(
    userId: string,
    query: ListRequestsQueryDto,
  ): Promise<Paginated<RequestSummaryDto>> {
    const { skip, take, page, limit } = toSkipTake(query);

    const where: Prisma.TaskWhereInput = {
      assigneeId: userId,
      ...(query.dutyStatus ? { status: query.dutyStatus as TaskStatus } : {}),
      instance: { response: this.commonWhere(query) },
    };

    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: dutyInclude,
        orderBy: this.dutyOrderBy(query),
        skip,
        take,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toDutySummary(r)),
      meta: buildMeta(total, page, limit),
    };
  }

  /**
   * Requests the user may view — excluding their own (for workflow review),
   * optionally filtered + paginated.
   */
  async getByViewer(
    userId: string,
    query: ListRequestsQueryDto,
  ): Promise<Paginated<RequestSummaryDto>> {
    return this.listRequests(
      {
        ...this.commonWhere(query),
        viewers: { some: { userId } },
        NOT: { createdById: userId },
      },
      query,
    );
  }

  /** Full request detail: EAV values, viewers, documents, and its full approval flow. */
  async getOne(id: string): Promise<RequestDetailDto> {
    const row = await this.prisma.formResponse.findUnique({
      where: { id },
      include: {
        ...summaryInclude,
        values: { select: { fieldKey: true, value: true } },
        viewers: { select: { userId: true } },
        documents: {
          select: { documentId: true, signing: true, section: true },
        },
        actualActors: {
          include: { user: true },
          orderBy: { order: 'asc' },
        },
        projectedTasks: {
          include: { assignee: true },
          orderBy: { createdAt: 'desc' },
        },
        signatureFields: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Request not found');
    }
    const flow = await this.engine.getStatus(id);
    return {
      ...this.toSummary(row),
      values: row.values.map((v) => ({ fieldKey: v.fieldKey, value: v.value })),
      viewerIds: row.viewers.map((v) => v.userId),
      documentIds: row.documents.map((d) => d.documentId),
      documents: row.documents.map((d) => ({
        documentId: d.documentId,
        section: d.section,
        signing: d.signing,
      })),
      signatureDocumentId:
        row.documents.find((d) => d.signing)?.documentId ?? null,
      flow,
      actualActors: (row as any).actualActors?.map((a: any) => ({
        taskDefinitionKey: a.taskDefinitionKey,
        taskName: a.taskName,
        userId: a.userId,
        userName: a.user?.displayName || a.user?.email,
        department: a.department || a.user?.department,
        title: a.title || a.user?.title,
        isOverridden: a.isOverridden,
        order: a.order,
      })),
      projectedTasks: (row as any).projectedTasks?.map((t: any) => ({
        id: t.id,
        operatonTaskId: t.operatonTaskId,
        taskDefinitionKey: t.taskDefinitionKey,
        taskName: t.taskName,
        status: t.status,
        assigneeId: t.assigneeId,
        assigneeName: t.assignee?.displayName || t.assignee?.email,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      signatureFields: (row as any).signatureFields,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /**
   * Whether a user is an approval assignee on a request's flow — supports both
   * Procedure BPMN Runtime (TaskProjection, ActualActor, SignatureField) and
   * Legacy Flow (FlowAssignee), as well as system admins. Used to authorize viewer-sharing.
   */
  private async isApprovalAssignee(
    responseId: string,
    userId: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'admin') return true;

    const [projected, actual, sig, legacy] = await Promise.all([
      this.prisma.taskProjection.findFirst({
        where: { responseId, assigneeId: userId },
        select: { id: true },
      }),
      this.prisma.requestActualActor.findFirst({
        where: { responseId, userId },
        select: { id: true },
      }),
      this.prisma.signatureField.findFirst({
        where: { responseId, assigneeId: userId },
        select: { id: true },
      }),
      this.prisma.flowAssignee.findFirst({
        where: {
          userId,
          type: { not: TaskType.CLOSE },
          step: { flow: { instances: { some: { responseId } } } },
        },
        select: { id: true },
      }),
    ]);
    return !!(projected || actual || sig || legacy);
  }

  /**
   * Shared filter predicate for every list scope: form category, status,
   * creator, created-at range, and a free-text search across request id, form
   * name and creator name/email. Scope-specific predicates are merged on top.
   */
  private commonWhere(
    query: ListRequestsQueryDto,
  ): Prisma.FormResponseWhereInput {
    const where: Prisma.FormResponseWhereInput = {};

    if (query.formId) where.formVersion = { formId: query.formId };
    if (query.status) where.status = query.status;
    if (query.createdById) where.createdById = query.createdById;

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.createdFrom) createdAt.gte = new Date(query.createdFrom);
    if (query.createdTo) createdAt.lte = endOfDayIfDateOnly(query.createdTo);
    if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        {
          formVersion: {
            form: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        { createdBy: { displayName: { contains: search, mode: 'insensitive' } } },
        { createdBy: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private async listRequests(
    where: Prisma.FormResponseWhereInput,
    query: ListRequestsQueryDto,
  ): Promise<Paginated<RequestSummaryDto>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const [rows, total] = await Promise.all([
      this.prisma.formResponse.findMany({
        where,
        include: summaryInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.formResponse.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toSummary(r)),
      meta: buildMeta(total, page, limit),
    };
  }

  /** Translate a duty `sortBy`/`sortDir` into a Prisma Task orderBy. */
  private dutyOrderBy(
    query: ListRequestsQueryDto,
  ): Prisma.TaskOrderByWithRelationInput {
    const dir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';
    switch (query.sortBy) {
      case 'dutyActed':
        return { actedAt: dir };
      case 'requestCreated':
        return { instance: { response: { createdAt: dir } } };
      case 'requestStatus':
        return { instance: { response: { status: dir } } };
      case 'formName':
        return {
          instance: { response: { formVersion: { form: { name: dir } } } },
        };
      case 'dutyCreated':
      default:
        return { instance: { response: { createdAt: dir } } };
    }
  }

  private toDutySummary(row: DutyRow): RequestSummaryDto {
    return {
      ...this.toSummary(row.instance.response),
      dutyStatus: row.status,
      dutyAction: row.action,
      dutyType: row.type,
      dutyCreatedAt: row.instance.response.createdAt,
      dutyActedAt: row.actedAt,
    };
  }

  /**
   * Build the requester's approval flow (Flow + steps + assignees) inside a
   * transaction. The final (highest-order) step is the closing step: when its
   * approver signs/approves, the request is APPROVED — there is no separate
   * requestor close step. Returns the new flow id, or undefined when no steps
   * were given (request is then auto-approved). Shared by create + submitDraft.
   */
  private async buildFlow(
    tx: Prisma.TransactionClient,
    responseId: string,
    dto: {
      steps?: CreateFlowStepInput[];
      flowName?: string;
    },
  ): Promise<string | undefined> {
    if (!dto.steps?.length) return undefined;

    const flow = await tx.flow.create({
      data: { name: dto.flowName ?? `Approval flow for ${responseId}` },
    });
    // The closing step is the highest-order step; it is always marked final and
    // required so completing it finalizes the request.
    const finalOrder = Math.max(...dto.steps.map((s) => s.order));
    for (const step of dto.steps) {
      const isFinal = step.order === finalOrder;
      const flowStep = await tx.flowStep.create({
        data: {
          flowId: flow.id,
          order: step.order,
          mode: step.mode,
          name: step.name ?? null,
          isFinal,
          required: isFinal || (step.required ?? false),
        },
      });
      await tx.flowAssignee.createMany({
        data: step.assignees.map((a) => ({
          stepId: flowStep.id,
          userId: a.userId,
          order: a.order ?? null,
          type: a.type ?? TaskType.APPROVAL,
        })),
      });
    }

    return flow.id;
  }

  /**
   * Signing constraint: a request with an approval flow MUST carry a signing
   * document, and every approver in the flow must have at least one signature
   * box on it before the flow can start. Because the flow is rebuilt from
   * scratch on every (re)submit, this re-runs each time — so whenever the
   * approver list changes, the boxes must be (re)positioned to cover it.
   *
   * No approvers at all (empty flow → auto-approved) needs no signing document.
   */
  private async validateSignatureCoverage(
    tx: Prisma.TransactionClient,
    responseId: string,
    steps?: CreateFlowStepInput[],
  ): Promise<void> {
    const required = new Set<string>();
    for (const step of steps ?? []) {
      for (const a of step.assignees) {
        if ((a.type ?? TaskType.APPROVAL) !== TaskType.CLOSE) {
          required.add(a.userId);
        }
      }
    }
    if (required.size === 0) return;

    const signing = await tx.requestDocument.findFirst({
      where: { responseId, signing: true },
      select: { documentId: true },
    });
    if (!signing) {
      throw new BadRequestException(
        'A signing document is required for the approval flow',
      );
    }

    const fields = await tx.signatureField.findMany({
      where: { responseId, documentId: signing.documentId },
      select: { assigneeId: true },
    });
    const positioned = new Set(fields.map((f) => f.assigneeId));
    const missing = [...required].filter((u) => !positioned.has(u));
    if (missing.length) {
      throw new BadRequestException(
        'Every approver must have a signature position on the signing document',
      );
    }
  }

  private async clone(
    userId: string,
    id: string,
    mode: 'reserve' | 'reset',
  ): Promise<RequestDetailDto> {
    const created = await this.prisma.$transaction((tx) =>
      this.cloneWithin(tx, userId, id, mode),
    );
    return this.getOne(created.id);
  }

  /**
   * Clone a request inside an existing transaction; returns the new row. Used
   * directly by clone-* and composed by revise (clone + cancel).
   *
   * Every clone starts as a DRAFT the requestor finalizes via submitDraft
   * (draft → pending). The approval flow differs by `mode`:
   *  - reset   → not snapshotted; the requestor edits + rebuilds it on confirm.
   *  - reserve → the whole flow (Flow + steps + assignees + instance + tasks,
   *              with their statuses) is deep-copied so granted approvals carry
   *              over; on confirm the flow resumes from the change step.
   */
  private async cloneWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    mode: 'reserve' | 'reset',
  ) {
    const src = await tx.formResponse.findUnique({
      where: { id },
      include: {
        values: true,
        viewers: true,
        documents: true,
        signatureFields: true,
        flowInstance: {
          include: {
            tasks: true,
            flow: {
              include: {
                steps: { orderBy: { order: 'asc' }, include: { assignees: true } },
              },
            },
          },
        },
      },
    });
    if (!src) {
      throw new NotFoundException('Request not found');
    }

    const clone = await tx.formResponse.create({
      data: {
        formVersionId: src.formVersionId,
        createdById: userId,
        clonedFromId: src.id,
        cloneMode: mode,
        status: RequestStatus.DRAFT,
      },
    });

    if (src.values.length) {
      await tx.formResponseValue.createMany({
        data: src.values.map((v) => ({
          responseId: clone.id,
          fieldKey: v.fieldKey,
          value: v.value as Prisma.InputJsonValue,
        })),
      });
    }

    // Carry over viewers and document links so the clone is a full copy the
    // requestor can then adjust (documents are shared rows, just re-linked).
    if (src.viewers.length) {
      await tx.requestViewer.createMany({
        data: src.viewers.map((v) => ({
          responseId: clone.id,
          userId: v.userId,
        })),
        skipDuplicates: true,
      });
    }
    // Re-link documents, carrying over the signing flag and the section
    // (MAIN/SECONDARY) so the clone is a faithful copy the requestor can adjust.
    if (src.documents.length) {
      await tx.requestDocument.createMany({
        data: src.documents.map((d) => ({
          responseId: clone.id,
          documentId: d.documentId,
          signing: d.signing,
          section: d.section,
        })),
      });
    }

    // Signature positions/state:
    //  - reserve → carry over every box WITH its sign state (kept signatures).
    //  - reset   → drop all boxes; the signing document link is kept (origin,
    //              unsigned) so the owner can re-position or upload anew.
    if (mode === 'reserve' && src.signatureFields.length) {
      await tx.signatureField.createMany({
        data: src.signatureFields.map((f) => ({
          responseId: clone.id,
          documentId: f.documentId,
          assigneeId: f.assigneeId,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          status: f.status,
          signatureName: f.signatureName,
          signatureImage: f.signatureImage,
          signedAt: f.signedAt,
        })),
      });
    }

    // reserve → deep-copy the whole approval flow into independent rows so the
    // clone carries every prior approval (tasks keep their status/action). The
    // copy is a self-contained Flow + steps + assignees + instance + tasks; on
    // confirm the engine resumes it from the step where changes were requested.
    if (mode === 'reserve' && src.flowInstance) {
      const srcFlow = src.flowInstance.flow;
      const newFlow = await tx.flow.create({
        data: { name: srcFlow.name },
      });
      // Map each source step id → its freshly created copy so tasks re-point.
      const stepIdMap = new Map<string, string>();
      for (const step of srcFlow.steps) {
        const newStep = await tx.flowStep.create({
          data: {
            flowId: newFlow.id,
            order: step.order,
            mode: step.mode,
            name: step.name,
            isFinal: step.isFinal,
            required: step.required,
          },
        });
        stepIdMap.set(step.id, newStep.id);
        if (step.assignees.length) {
          await tx.flowAssignee.createMany({
            data: step.assignees.map((a) => ({
              stepId: newStep.id,
              userId: a.userId,
              order: a.order,
              type: a.type,
            })),
          });
        }
      }
      const newInstance = await tx.flowInstance.create({
        data: {
          flowId: newFlow.id,
          responseId: clone.id,
          currentStep: src.flowInstance.currentStep,
          isDone: false,
        },
      });
      if (src.flowInstance.tasks.length) {
        await tx.task.createMany({
          data: src.flowInstance.tasks.map((task) => ({
            instanceId: newInstance.id,
            stepId: stepIdMap.get(task.stepId)!,
            assigneeId: task.assigneeId,
            type: task.type,
            status: task.status,
            action: task.action,
            actedAt: task.actedAt,
          })),
        });
      }
    }

    return clone;
  }

  private toSummary(row: SummaryRow): RequestSummaryDto {
    return {
      id: row.id,
      status: row.status,
      formId: row.formVersion.form.id,
      formName: row.formVersion.form.name,
      formVersionId: row.formVersionId,
      version: row.formVersion.version,
      createdById: row.createdById,
      clonedFromId: row.clonedFromId,
      cloneMode: row.cloneMode,
      createdAt: row.createdAt,
      procedureVersionId: (row as any).procedureVersionId ?? null,
      procedure: (row as any).procedureVersion?.procedure
        ? {
            id: (row as any).procedureVersion.procedure.id,
            code: (row as any).procedureVersion.procedure.code,
            name: (row as any).procedureVersion.procedure.name,
          }
        : null,
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Phase 5: Operaton Runtime & PDF Signing Integration
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Create a draft request from a published Procedure (REQ-RUN-01, ADR-005).
   */
  async createFromProcedure(
    dto: CreateRequestFromProcedureDto,
    userId: string,
  ) {
    let procedureVersion: any;

    if (dto.procedureVersionId) {
      procedureVersion = await this.prisma.procedureVersion.findUnique({
        where: { id: dto.procedureVersionId },
        include: {
          procedure: true,
          formVersion: true,
          actorMappings: {
            include: { defaultUser: true },
            orderBy: { order: 'asc' },
          },
          variableMappings: true,
        },
      });
    } else if (dto.procedureId) {
      const proc = await this.prisma.procedure.findUnique({
        where: { id: dto.procedureId },
        include: {
          activeVersion: {
            include: {
              procedure: true,
              formVersion: true,
              actorMappings: {
                include: { defaultUser: true },
                orderBy: { order: 'asc' },
              },
              variableMappings: true,
            },
          },
        },
      });
      procedureVersion = proc?.activeVersion;
    }

    if (!procedureVersion || procedureVersion.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Không tìm thấy phiên bản Thủ tục hợp lệ hoặc Thủ tục chưa được xuất bản',
      );
    }

    if (!procedureVersion.formVersionId) {
      throw new BadRequestException(
        'Thủ tục này chưa được cấu hình Biểu mẫu (FormVersion)',
      );
    }

    const response = await this.prisma.formResponse.create({
      data: {
        procedureVersionId: procedureVersion.id,
        formVersionId: procedureVersion.formVersionId,
        createdById: userId,
        status: RequestStatus.DRAFT,
      },
      include: {
        procedureVersion: {
          include: {
            procedure: true,
            actorMappings: {
              include: { defaultUser: true },
              orderBy: { order: 'asc' },
            },
          },
        },
        formVersion: {
          include: {
            form: true,
          },
        },
      },
    });

    // Seed default actors into RequestActualActor (resolving dynamic rules or direct users)
    const resolvedOrigins = new Map<string, string>();
    const mappingMap = new Map<string, any>(
      procedureVersion.actorMappings.map((m: any) => [m.taskDefinitionKey, m]),
    );

    for (const mapping of procedureVersion.actorMappings) {
      const resolved = await this.actorResolver.resolveActor(mapping, userId);
      if (resolved?.user) {
        resolvedOrigins.set(mapping.taskDefinitionKey, resolved.resolutionOrigin || '');
        await this.prisma.requestActualActor.create({
          data: {
            responseId: response.id,
            taskDefinitionKey: mapping.taskDefinitionKey,
            taskName: mapping.taskName,
            userId: resolved.user.id,
            isOverridden: false,
            order: mapping.order,
            department: resolved.user.department || null,
            title: resolved.user.title || null,
          },
        });
      }
    }

    const actualActors = await this.prisma.requestActualActor.findMany({
      where: { responseId: response.id },
      include: { user: true },
      orderBy: { order: 'asc' },
    });

    const mappedActors = actualActors.map((a) => {
      const mapping = mappingMap.get(a.taskDefinitionKey);
      return {
        id: a.id,
        taskDefinitionKey: a.taskDefinitionKey,
        taskName: a.taskName,
        userId: a.userId,
        userName: a.user.displayName || a.user.email,
        fullName: a.user.displayName || a.user.email,
        department: a.department,
        title: a.title,
        order: a.order,
        isOverridden: a.isOverridden,
        allowOverride: mapping?.allowOverride !== false,
        resolutionOrigin: resolvedOrigins.get(a.taskDefinitionKey) || undefined,
      };
    });

    return {
      id: response.id,
      status: response.status,
      formId: response.formVersion.formId,
      formName: response.formVersion.form?.name || '',
      formVersionId: response.formVersion.id,
      procedure: {
        id: procedureVersion.procedure.id,
        code: procedureVersion.procedure.code,
        name: procedureVersion.procedure.name,
        icon: procedureVersion.procedure.icon,
      },
      procedureVersion: {
        id: procedureVersion.id,
        version: procedureVersion.version,
        operatonDefinitionKey: procedureVersion.operatonDefinitionKey,
      },
      formVersion: {
        id: response.formVersion.id,
        formId: response.formVersion.formId,
        version: response.formVersion.version,
        layoutSchema: response.formVersion.layoutSchema,
      },
      actualActors: mappedActors,
      defaultActors: mappedActors,
      createdAt: response.createdAt,
    };
  }

  /**
   * Evaluate form variables and simulate execution path on BPMN (REQ-RUN-01).
   */
  async previewFlow(
    requestId: string,
    values: Record<string, any>,
  ): Promise<FlowSimulationResult> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
      include: {
        procedureVersion: {
          include: {
            actorMappings: {
              include: { defaultUser: true },
              orderBy: { order: 'asc' },
            },
            variableMappings: true,
          },
        },
      },
    });

    if (!request || !request.procedureVersion) {
      throw new NotFoundException('Yêu cầu hoặc Phiên bản Thủ tục không tồn tại');
    }

    if (!request.procedureVersion.bpmnSnapshotXml) {
      throw new BadRequestException('Thủ tục chưa có sơ đồ BPMN Snapshot');
    }

    const bpmnStructure = this.bpmnParser.parse(
      request.procedureVersion.bpmnSnapshotXml,
    );

    return this.flowSimulation.simulate(
      bpmnStructure,
      request.procedureVersion.variableMappings,
      request.procedureVersion.actorMappings,
      values || {},
    );
  }

  /**
   * Preview & override actual approvers where allowOverride = true (REQ-RUN-02, ADR-003).
   */
  async setActualActors(
    requestId: string,
    actors: ActualActorItemDto[],
    userId: string,
  ) {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
      include: {
        procedureVersion: {
          include: {
            actorMappings: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Yêu cầu không tồn tại');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Bạn không phải người tạo hồ sơ này');
    }
    if (
      request.status !== RequestStatus.DRAFT &&
      request.status !== RequestStatus.REQUEST_CHANGES
    ) {
      throw new BadRequestException(
        'Chỉ có thể sửa người duyệt khi hồ sơ ở trạng thái DRAFT hoặc REQUEST_CHANGES',
      );
    }

    const mappingMap = new Map(
      (request.procedureVersion?.actorMappings || []).map((m) => [
        m.taskDefinitionKey,
        m,
      ]),
    );

    for (const actor of actors) {
      const mapping = mappingMap.get(actor.taskDefinitionKey);
      if (mapping && !mapping.allowOverride) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: `Bước duyệt '${mapping.taskName}' không cho phép người trình thay đổi người duyệt.`,
          code: 'ERR_ACTOR_OVERRIDE_DENIED',
        });
      }
    }

    // Save actual actors
    for (const actor of actors) {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.userId },
      });
      if (!user) {
        throw new BadRequestException(`Không tìm thấy người dùng ${actor.userId}`);
      }

      const mapping = mappingMap.get(actor.taskDefinitionKey);
      const taskName = mapping?.taskName || actor.taskDefinitionKey;

      const existing = await this.prisma.requestActualActor.findFirst({
        where: {
          responseId: requestId,
          taskDefinitionKey: actor.taskDefinitionKey,
        },
      });

      if (existing) {
        await this.prisma.requestActualActor.update({
          where: { id: existing.id },
          data: {
            userId: actor.userId,
            isOverridden: true,
            order: actor.order ?? existing.order,
            department: user.department || null,
            title: user.title || null,
          },
        });
      } else {
        await this.prisma.requestActualActor.create({
          data: {
            responseId: requestId,
            taskDefinitionKey: actor.taskDefinitionKey,
            taskName,
            userId: actor.userId,
            isOverridden: true,
            order: actor.order ?? 1,
            department: user.department || null,
            title: user.title || null,
          },
        });
      }
    }

    const updated = await this.prisma.requestActualActor.findMany({
      where: { responseId: requestId },
      include: { user: true },
      orderBy: { order: 'asc' },
    });

    return {
      success: true,
      actualActors: updated.map((a) => ({
        id: a.id,
        taskDefinitionKey: a.taskDefinitionKey,
        taskName: a.taskName,
        userId: a.userId,
        fullName: a.user.displayName || a.user.email,
        department: a.department,
        title: a.title,
        isOverridden: a.isOverridden,
        order: a.order,
      })),
    };
  }

  /**
   * Submit draft procedure request: start Operaton process instance (REQ-RUN-01, REQ-RUN-02).
   */
  async submitProcedureRequest(
    requestId: string,
    values: Record<string, any> | undefined,
    userId: string,
  ) {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
      include: {
        procedureVersion: {
          include: {
            actorMappings: { include: { defaultUser: true } },
            variableMappings: true,
          },
        },
        formVersion: true,
        actualActors: { include: { user: true } },
      },
    });

    if (!request || !request.procedureVersion) {
      throw new NotFoundException('Yêu cầu hoặc phiên bản thủ tục không tồn tại');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Bạn không có quyền nộp hồ sơ này');
    }
    if (request.status !== RequestStatus.DRAFT) {
      throw new BadRequestException('Hồ sơ không ở trạng thái DRAFT');
    }

    // Upsert any passed form values
    if (values && Object.keys(values).length > 0) {
      for (const [key, val] of Object.entries(values)) {
        await this.prisma.formResponseValue.upsert({
          where: {
            responseId_fieldKey: { responseId: requestId, fieldKey: key },
          },
          create: {
            responseId: requestId,
            fieldKey: key,
            value: val as Prisma.InputJsonValue,
          },
          update: {
            value: val as Prisma.InputJsonValue,
          },
        });
      }
    }

    // Load full values
    const allValRows = await this.prisma.formResponseValue.findMany({
      where: { responseId: requestId },
    });
    const currentValues: Record<string, any> = {};
    for (const row of allValRows) {
      currentValues[row.fieldKey] = row.value;
    }

    // Run simulation to identify active branches
    const bpmnStructure = this.bpmnParser.parse(
      request.procedureVersion.bpmnSnapshotXml || '',
    );
    const simulation = this.flowSimulation.simulate(
      bpmnStructure,
      request.procedureVersion.variableMappings,
      request.procedureVersion.actorMappings,
      currentValues,
    );

    // Validate active tasks have assignees
    const assignedMap = new Map(
      request.actualActors.map((a) => [a.taskDefinitionKey, a]),
    );
    const missingActors: string[] = [];
    for (const taskKey of simulation.activeTaskKeys) {
      if (!assignedMap.has(taskKey)) {
        missingActors.push(taskKey);
      }
    }

    if (missingActors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `Thiếu người duyệt cho các bước: ${missingActors.join(', ')}`,
        code: 'VAL-ACT-EMPTY',
      });
    }

    // Build Operaton variables
    const opVars: Record<string, { value: any; type: string }> = {};

    // 1. Condition variables
    for (const [k, v] of Object.entries(simulation.variables)) {
      opVars[k] = {
        value: v,
        type:
          typeof v === 'number'
            ? 'Long'
            : typeof v === 'boolean'
            ? 'Boolean'
            : 'String',
      };
    }

    // 2. Actor variables
    const taskMap = new Map(bpmnStructure.tasks.map((t) => [t.taskKey, t]));
    for (const actor of request.actualActors) {
      opVars[`actor_${actor.taskDefinitionKey}`] = {
        value: actor.userId,
        type: 'String',
      };
      opVars[`actorList_${actor.taskDefinitionKey}`] = {
        value: JSON.stringify([actor.userId]),
        type: 'String',
      };

      const bpmnTask = taskMap.get(actor.taskDefinitionKey);
      if (bpmnTask?.assigneeVariable) {
        opVars[bpmnTask.assigneeVariable] = {
          value: actor.userId,
          type: 'String',
        };
      }
      if (bpmnTask?.collectionVariable) {
        opVars[bpmnTask.collectionVariable] = {
          value: JSON.stringify([actor.userId]),
          type: 'String',
        };
      }
    }

    // Defensive fallback: populate any missing default actor mappings from procedureVersion
    for (const mapping of request.procedureVersion.actorMappings) {
      if (mapping.defaultUserId) {
        if (!opVars[`actor_${mapping.taskDefinitionKey}`]) {
          opVars[`actor_${mapping.taskDefinitionKey}`] = {
            value: mapping.defaultUserId,
            type: 'String',
          };
        }
        const bpmnTask = taskMap.get(mapping.taskDefinitionKey);
        if (bpmnTask?.assigneeVariable && !opVars[bpmnTask.assigneeVariable]) {
          opVars[bpmnTask.assigneeVariable] = {
            value: mapping.defaultUserId,
            type: 'String',
          };
        }
      }
    }

    const definitionId =
      request.procedureVersion.operatonDefinitionId ||
      request.procedureVersion.operatonDefinitionKey;

    if (!definitionId) {
      throw new BadRequestException('Thủ tục chưa có liên kết ProcessDefinition Operaton');
    }

    // Start instance in Operaton
    const instanceRes = await this.operatonClient.startInstance(
      definitionId,
      requestId,
      opVars,
    );

    // Fetch initial active tasks
    const activeTasks = await this.operatonClient.getActiveTasks(instanceRes.id);

    // Populate TaskProjection
    for (const t of activeTasks) {
      const assigned = assignedMap.get(t.taskDefinitionKey);
      const assigneeId = assigned?.userId || userId;

      await this.prisma.taskProjection.upsert({
        where: { operatonTaskId: t.id },
        create: {
          operatonTaskId: t.id,
          processInstanceId: instanceRes.id,
          responseId: requestId,
          taskDefinitionKey: t.taskDefinitionKey,
          taskName: t.name || t.taskDefinitionKey,
          assigneeId,
          status: 'ACTIVE',
        },
        update: {
          status: 'ACTIVE',
          assigneeId,
        },
      });
    }

    // Update FormResponse status
    const updated = await this.prisma.formResponse.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.PENDING,
        operatonProcessInstanceId: instanceRes.id,
        operatonProcessDefinitionId: instanceRes.definitionId,
        businessKey: requestId,
      },
    });

    // Record submit comment
    await this.prisma.requestComment.create({
      data: {
        responseId: requestId,
        authorId: userId,
        body: '[SUBMIT] Đã nộp hồ sơ yêu cầu phê duyệt',
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      operatonProcessInstanceId: instanceRes.id,
      businessKey: requestId,
      activeTasks: activeTasks.map((t) => ({
        taskId: t.id,
        taskDefinitionKey: t.taskDefinitionKey,
        taskName: t.name,
        assigneeId: assignedMap.get(t.taskDefinitionKey)?.userId,
      })),
    };
  }

  /**
   * Get BPMN execution status, active & completed tasks (REQ-RUN-01, REQ-RUN-04).
   */
  async getFlowStatus(requestId: string, userId: string) {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
      include: {
        procedureVersion: {
          include: { procedure: true },
        },
        actualActors: {
          include: { user: true },
          orderBy: { order: 'asc' },
        },
        projectedTasks: {
          include: { assignee: true },
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Yêu cầu không tồn tại');
    }

    const activeTasks = request.projectedTasks.filter((t) => t.status === 'ACTIVE');
    const completedTasks = request.projectedTasks.filter((t) => t.status === 'COMPLETED');

    return {
      processInstanceId: request.operatonProcessInstanceId,
      status: request.status,
      bpmn20Xml: request.procedureVersion?.bpmnSnapshotXml || null,
      activeTaskKeys: activeTasks.map((t) => t.taskDefinitionKey),
      completedTaskKeys: completedTasks.map((t) => t.taskDefinitionKey),
      activeTasks: activeTasks.map((t) => ({
        id: t.id,
        operatonTaskId: t.operatonTaskId,
        taskDefinitionKey: t.taskDefinitionKey,
        taskName: t.taskName,
        assignee: {
          id: t.assignee.id,
          name: t.assignee.displayName || t.assignee.email,
          department: t.assignee.department,
          title: t.assignee.title,
        },
        createdAt: t.createdAt,
      })),
      actualActors: request.actualActors.map((a) => ({
        taskDefinitionKey: a.taskDefinitionKey,
        taskName: a.taskName,
        assignee: {
          id: a.user.id,
          name: a.user.displayName || a.user.email,
          department: a.department || a.user.department,
          title: a.title || a.user.title,
        },
        isOverridden: a.isOverridden,
        order: a.order,
      })),
      history: request.comments.map((c) => {
        let action = 'COMMENT';
        let comment = c.body;
        if (c.body.startsWith('[') && c.body.includes(']')) {
          action = c.body.substring(1, c.body.indexOf(']'));
          comment = c.body.substring(c.body.indexOf(']') + 1).trim();
        }
        return {
          id: c.id,
          action,
          actorName: c.author?.displayName || c.author?.email || 'Hệ thống',
          timestamp: c.createdAt,
          comment,
        };
      }),
    };
  }

  /**
   * Fast query for "My Duties" from TaskProjection (REQ-RUN-04).
   */
  async getMyDuties(userId: string, query: DutyQueryDto) {
    const isCompleted =
      query.dutyStatus === 'DONE' || query.tab === 'completed';
    const isPending =
      query.dutyStatus === 'PENDING' || query.tab === 'pending';
    const statusFilter = isCompleted
      ? 'COMPLETED'
      : isPending
      ? 'ACTIVE'
      : undefined;

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TaskProjectionWhereInput = {
      assigneeId: userId,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    if (query.procedureId) {
      where.response = {
        ...(where.response as Prisma.FormResponseWhereInput || {}),
        procedureVersion: {
          procedureId: query.procedureId,
        },
      };
    }

    if (query.formId) {
      where.response = {
        ...(where.response as Prisma.FormResponseWhereInput || {}),
        formVersion: {
          formId: query.formId,
        },
      };
    }

    if (query.status) {
      where.response = {
        ...(where.response as Prisma.FormResponseWhereInput || {}),
        status: query.status,
      };
    }

    if (query.createdById) {
      where.response = {
        ...(where.response as Prisma.FormResponseWhereInput || {}),
        createdById: query.createdById,
      };
    }

    const q = (query.search || query.q)?.trim();
    if (q) {
      where.OR = [
        { taskName: { contains: q, mode: 'insensitive' } },
        {
          response: {
            procedureVersion: {
              procedure: {
                name: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
        {
          response: {
            createdBy: {
              displayName: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    // Determine sorting
    const dir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';
    let orderBy: Prisma.TaskProjectionOrderByWithRelationInput = { createdAt: dir };
    if (query.sortBy === 'dutyActed') {
      orderBy = { completedAt: dir };
    } else if (query.sortBy === 'requestCreated') {
      orderBy = { response: { createdAt: dir } };
    } else if (query.sortBy === 'requestStatus') {
      orderBy = { response: { status: dir } };
    } else if (query.sortBy === 'formName') {
      orderBy = { taskName: dir };
    } else {
      orderBy = { createdAt: dir };
    }

    const [total, tasks] = await Promise.all([
      this.prisma.taskProjection.count({ where }),
      this.prisma.taskProjection.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          response: {
            include: {
              createdBy: true,
              procedureVersion: {
                include: { procedure: true },
              },
              signatureFields: {
                where: { assigneeId: userId, status: 'PENDING' },
              },
            },
          },
        },
      }),
    ]);

    if (total === 0) {
      const legacyCount = await this.prisma.task.count({
        where: {
          assigneeId: userId,
          ...(query.dutyStatus ? { status: query.dutyStatus as TaskStatus } : {}),
        },
      });
      if (legacyCount > 0) {
        return this.getByDuty(userId, query as any);
      }
    }

    const items = tasks.map((t) => ({
      // flattened fields for RequestSummary compatibility:
      id: t.response.id,
      status: t.response.status,
      formId: t.response.formVersionId,
      formName: t.response.procedureVersion?.procedure?.name || t.taskName,
      formVersionId: t.response.formVersionId,
      version: 1,
      createdById: t.response.createdById,
      clonedFromId: t.response.clonedFromId,
      cloneMode: t.response.cloneMode,
      createdAt: t.response.createdAt,
      dutyStatus: t.status === 'ACTIVE' ? 'PENDING' : 'DONE',
      dutyAction: null,
      dutyType: (t.response.signatureFields || []).length > 0 ? 'APPROVAL' : 'APPROVAL',
      dutyCreatedAt: t.createdAt,
      dutyActedAt: t.completedAt,
      // procedure and task details:
      taskId: t.operatonTaskId,
      taskDefinitionKey: t.taskDefinitionKey,
      taskName: t.taskName,
      dueDate: t.dueDate,
      taskStatus: t.status,
      requiresSignature: (t.response.signatureFields || []).length > 0,
      pendingSignatureCount: (t.response.signatureFields || []).length,
      procedure: t.response.procedureVersion?.procedure
        ? {
            id: t.response.procedureVersion.procedure.id,
            code: t.response.procedureVersion.procedure.code,
            name: t.response.procedureVersion.procedure.name,
          }
        : null,
      request: {
        id: t.response.id,
        status: t.response.status,
        procedureName:
          t.response.procedureVersion?.procedure?.name || 'Hồ sơ đề xuất',
        procedureCode: t.response.procedureVersion?.procedure?.code,
        requester: {
          id: t.response.createdBy.id,
          name: t.response.createdBy.displayName || t.response.createdBy.email,
          department: t.response.createdBy.department,
          title: t.response.createdBy.title,
        },
        createdAt: t.response.createdAt,
      },
    }));

    return {
      items,
      total,
      page,
      limit,
      meta: buildMeta(total, page, limit),
    };
  }

  /**
   * Approve task on Operaton with PDF Signature enforcement (REQ-RUN-03).
   */
  async approveTask(
    requestId: string,
    taskId: string,
    comment: string | undefined,
    userId: string,
  ) {
    const task = await this.prisma.taskProjection.findUnique({
      where: { operatonTaskId: taskId },
    });

    if (!task || task.responseId !== requestId) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Bạn không được giao thực hiện nhiệm vụ này');
    }
    if (task.status !== 'ACTIVE') {
      throw new BadRequestException('Nhiệm vụ này đã được hoàn thành hoặc đã bị hủy');
    }

    // Check mandatory signature enforcement
    const pendingSigs = await this.prisma.signatureField.findMany({
      where: {
        responseId: requestId,
        assigneeId: userId,
        status: 'PENDING',
        OR: [
          { taskDefinitionKey: task.taskDefinitionKey },
          { taskDefinitionKey: null },
        ],
      },
    });

    if (pendingSigs.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message:
          'Bạn chưa ký số vào tài liệu đính kèm của bước duyệt này. Vui lòng thực hiện ký số trước khi duyệt.',
        code: 'ERR_SIGNATURE_REQUIRED',
        details: {
          pendingSignatureFieldIds: pendingSigs.map((s) => s.id),
        },
      });
    }

    // Complete task on Operaton
    await this.operatonClient.completeTask(taskId, {
      approved: { value: true, type: 'Boolean' },
    });

    // Update TaskProjection to COMPLETED
    await this.prisma.taskProjection.update({
      where: { operatonTaskId: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Check next active tasks
    const remainingTasks = await this.operatonClient.getActiveTasks(
      task.processInstanceId,
    );

    let nextStatus: RequestStatus = RequestStatus.PENDING;
    if (remainingTasks.length > 0) {
      // Find actual actors for remaining tasks
      const actualActors = await this.prisma.requestActualActor.findMany({
        where: { responseId: requestId },
      });
      const actorMap = new Map(actualActors.map((a) => [a.taskDefinitionKey, a]));

      for (const nextT of remainingTasks) {
        const assigned = actorMap.get(nextT.taskDefinitionKey);
        await this.prisma.taskProjection.upsert({
          where: { operatonTaskId: nextT.id },
          create: {
            operatonTaskId: nextT.id,
            processInstanceId: task.processInstanceId,
            responseId: requestId,
            taskDefinitionKey: nextT.taskDefinitionKey,
            taskName: nextT.name || nextT.taskDefinitionKey,
            assigneeId: assigned?.userId || userId,
            status: 'ACTIVE',
          },
          update: {
            status: 'ACTIVE',
          },
        });
      }
    } else {
      // Flow completed
      nextStatus = RequestStatus.APPROVED;
      await this.prisma.formResponse.update({
        where: { id: requestId },
        data: { status: RequestStatus.APPROVED },
      });
    }

    // Add audit comment
    await this.prisma.requestComment.create({
      data: {
        responseId: requestId,
        authorId: userId,
        body: `[APPROVE] ${comment || 'Đã phê duyệt'}`,
      },
    });

    return {
      success: true,
      status: nextStatus,
      message: 'Phê duyệt thành công',
    };
  }

  /**
   * Stamp PDF signature and approve task atomically (REQ-RUN-03).
   */
  async signAndApproveTask(
    requestId: string,
    taskId: string,
    payload: SignAndApproveDto,
    userId: string,
  ) {
    const task = await this.prisma.taskProjection.findUnique({
      where: { operatonTaskId: taskId },
    });

    if (!task || task.responseId !== requestId) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Bạn không được giao thực hiện nhiệm vụ này');
    }

    // Stamp pending signature fields
    const sigWhere: Prisma.SignatureFieldWhereInput = {
      responseId: requestId,
      assigneeId: userId,
      status: 'PENDING',
    };
    if (payload.signatureFieldIds && payload.signatureFieldIds.length > 0) {
      sigWhere.id = { in: payload.signatureFieldIds };
    }

    await this.prisma.signatureField.updateMany({
      where: sigWhere,
      data: {
        status: 'SIGNED',
        signatureImage: payload.signatureImage || null,
        signatureName: payload.signatureName || null,
        signedAt: new Date(),
      },
    });

    // Now proceed with normal approve
    return this.approveTask(requestId, taskId, payload.comment, userId);
  }

  /**
   * Reject task and cancel Operaton instance (REQ-RUN-04).
   */
  async rejectTask(
    requestId: string,
    taskId: string,
    comment: string | undefined,
    userId: string,
  ) {
    const task = await this.prisma.taskProjection.findUnique({
      where: { operatonTaskId: taskId },
    });

    if (!task || task.responseId !== requestId) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Bạn không được giao thực hiện nhiệm vụ này');
    }

    try {
      await this.operatonClient.deleteProcessInstance(
        task.processInstanceId,
        `Từ chối bởi người duyệt: ${comment || ''}`,
      );
    } catch (err: any) {
      // Instance might have ended or been deleted
    }

    // Cancel all remaining tasks for this response
    await this.prisma.taskProjection.updateMany({
      where: { responseId: requestId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });

    // Mark pending signatures as REJECTED
    await this.prisma.signatureField.updateMany({
      where: { responseId: requestId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    await this.prisma.formResponse.update({
      where: { id: requestId },
      data: { status: RequestStatus.REJECTED },
    });

    await this.prisma.requestComment.create({
      data: {
        responseId: requestId,
        authorId: userId,
        body: `[REJECT] ${comment || 'Đã từ chối hồ sơ'}`,
      },
    });

    return {
      success: true,
      status: RequestStatus.REJECTED,
      message: 'Đã từ chối hồ sơ thành công',
    };
  }

  /**
   * Request changes on task, sending it back to requester (REQ-RUN-04).
   */
  async requestChangesTask(
    requestId: string,
    taskId: string,
    comment: string | undefined,
    userId: string,
  ) {
    const task = await this.prisma.taskProjection.findUnique({
      where: { operatonTaskId: taskId },
    });

    if (!task || task.responseId !== requestId) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Bạn không được giao thực hiện nhiệm vụ này');
    }

    await this.prisma.formResponse.update({
      where: { id: requestId },
      data: { status: RequestStatus.REQUEST_CHANGES },
    });

    await this.prisma.requestComment.create({
      data: {
        responseId: requestId,
        authorId: userId,
        body: `[REQUEST_CHANGES] ${comment || 'Yêu cầu chỉnh sửa và bổ sung thông tin'}`,
      },
    });

    return {
      success: true,
      status: RequestStatus.REQUEST_CHANGES,
      message: 'Đã gửi yêu cầu chỉnh sửa đến người trình',
    };
  }

  /**
   * Resubmit request with updated values (REQ-RUN-04).
   */
  async resubmitProcedureRequest(
    requestId: string,
    dto: ResubmitRequestDto,
    userId: string,
  ) {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
      include: {
        procedureVersion: {
          include: { variableMappings: true, actorMappings: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Hồ sơ không tồn tại');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Bạn không phải người tạo hồ sơ');
    }
    if (request.status !== RequestStatus.REQUEST_CHANGES) {
      throw new BadRequestException('Hồ sơ không ở trạng thái REQUEST_CHANGES');
    }

    if (dto.values && Object.keys(dto.values).length > 0) {
      for (const [key, val] of Object.entries(dto.values)) {
        await this.prisma.formResponseValue.upsert({
          where: {
            responseId_fieldKey: { responseId: requestId, fieldKey: key },
          },
          create: {
            responseId: requestId,
            fieldKey: key,
            value: val as Prisma.InputJsonValue,
          },
          update: {
            value: val as Prisma.InputJsonValue,
          },
        });
      }
    }

    await this.prisma.formResponse.update({
      where: { id: requestId },
      data: { status: RequestStatus.PENDING },
    });

    await this.prisma.requestComment.create({
      data: {
        responseId: requestId,
        authorId: userId,
        body: `[RESUBMIT] ${dto.comment || 'Đã chỉnh sửa và nộp lại hồ sơ'}`,
      },
    });

    return {
      success: true,
      status: RequestStatus.PENDING,
      message: 'Đã nộp lại hồ sơ thành công',
    };
  }

  /**
   * Cancel running procedure request (REQ-RUN-04).
   */
  async cancelProcedureRequest(
    requestId: string,
    reason: string | undefined,
    userId: string,
  ) {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Hồ sơ không tồn tại');
    }
    if (request.createdById !== userId) {
      throw new ForbiddenException('Bạn không phải người tạo hồ sơ');
    }

    if (request.operatonProcessInstanceId) {
      try {
        await this.operatonClient.deleteProcessInstance(
          request.operatonProcessInstanceId,
          reason || 'Hồ sơ bị hủy bởi người trình',
        );
      } catch (err: any) {
        // Already ended or deleted
      }
    }

    await this.prisma.taskProjection.updateMany({
      where: { responseId: requestId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.formResponse.update({
      where: { id: requestId },
      data: { status: RequestStatus.CANCELLED },
    });

    await this.prisma.requestComment.create({
      data: {
        responseId: requestId,
        authorId: userId,
        body: `[CANCEL] ${reason || 'Đã hủy hồ sơ'}`,
      },
    });

    return {
      success: true,
      status: RequestStatus.CANCELLED,
      message: 'Hồ sơ đã được hủy bỏ thành công',
    };
  }

  /**
   * Clone procedure request with reset / reserve mode (REQ-RUN-04).
   */
  async cloneProcedureRequest(
    requestId: string,
    mode: 'reset' | 'reserve',
    userId: string,
  ) {
    const source = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
      include: {
        values: true,
        actualActors: true,
        procedureVersion: true,
      },
    });

    if (!source || !source.procedureVersion) {
      throw new NotFoundException('Hồ sơ gốc không tồn tại hoặc không gắn với Thủ tục');
    }

    // Find latest published version of the procedure
    const latestVersion = await this.prisma.procedureVersion.findFirst({
      where: {
        procedureId: source.procedureVersion.procedureId,
        status: 'PUBLISHED',
      },
      orderBy: { version: 'desc' },
      include: {
        actorMappings: { include: { defaultUser: true } },
      },
    });

    if (!latestVersion || !latestVersion.formVersionId) {
      throw new BadRequestException('Không tìm thấy phiên bản xuất bản mới nhất của Thủ tục này');
    }

    // Create new DRAFT FormResponse
    const newRequest = await this.prisma.formResponse.create({
      data: {
        procedureVersionId: latestVersion.id,
        formVersionId: latestVersion.formVersionId,
        createdById: userId,
        status: RequestStatus.DRAFT,
        clonedFromId: source.id,
        cloneMode: mode,
      },
    });

    // Copy values
    if (source.values.length > 0) {
      await this.prisma.formResponseValue.createMany({
        data: source.values.map((v) => ({
          responseId: newRequest.id,
          fieldKey: v.fieldKey,
          value: v.value as Prisma.InputJsonValue,
        })),
      });
    }

    // Setup actors
    const sourceActorMap = new Map(source.actualActors.map((a) => [a.taskDefinitionKey, a]));

    for (const mapping of latestVersion.actorMappings) {
      const sourceActor = sourceActorMap.get(mapping.taskDefinitionKey);
      if (mode === 'reserve' && sourceActor && sourceActor.isOverridden && mapping.allowOverride) {
        await this.prisma.requestActualActor.create({
          data: {
            responseId: newRequest.id,
            taskDefinitionKey: mapping.taskDefinitionKey,
            taskName: mapping.taskName,
            userId: sourceActor.userId,
            isOverridden: true,
            order: mapping.order,
            department: sourceActor.department,
            title: sourceActor.title,
          },
        });
      } else {
        const resolved = await this.actorResolver.resolveActor(mapping, userId);
        if (resolved?.user) {
          await this.prisma.requestActualActor.create({
            data: {
              responseId: newRequest.id,
              taskDefinitionKey: mapping.taskDefinitionKey,
              taskName: mapping.taskName,
              userId: resolved.user.id,
              isOverridden: false,
              order: mapping.order,
              department: resolved.user.department || null,
              title: resolved.user.title || null,
            },
          });
        }
      }
    }

    return {
      newRequestId: newRequest.id,
      status: newRequest.status,
      procedureVersionId: latestVersion.id,
      message: 'Sao chép hồ sơ thành công',
    };
  }
}

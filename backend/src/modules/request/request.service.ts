import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

/** Include used to build a request summary (form id/name + version). */
const summaryInclude = {
  formVersion: {
    select: { version: true, form: { select: { id: true, name: true } } },
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
    // Values are editable only in "craft mode" — a DRAFT (e.g. a cloned draft
    // before it is confirmed). Once submitted, the content is locked.
    if (request.status !== RequestStatus.DRAFT) {
      throw new BadRequestException('Only a draft request can be edited');
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
  ): Promise<RequestDetailDto> {
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
  async cancelByRequestor(userId: string, id: string): Promise<RequestDetailDto> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id },
      include: { flowInstance: true },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
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
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /**
   * Whether a user is an approval assignee on a request's flow — i.e. they hold
   * an assignment in the flow blueprint (the legacy CLOSE duty, if any, is
   * excluded). Used to authorize viewer-sharing.
   */
  private async isApprovalAssignee(
    responseId: string,
    userId: string,
  ): Promise<boolean> {
    const assignee = await this.prisma.flowAssignee.findFirst({
      where: {
        userId,
        type: { not: TaskType.CLOSE },
        step: { flow: { instances: { some: { responseId } } } },
      },
      select: { id: true },
    });
    return !!assignee;
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
    };
  }
}

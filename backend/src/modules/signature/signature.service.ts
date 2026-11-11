import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RequestStatus,
  SignatureStatus,
  TaskAction,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ApprovalEngineService } from '../approval-flow/approval-engine.service';
import { FlowStatusDto } from '../approval-flow/dto/flow-status.dto';
import { SetSignatureDto } from './dto/set-signature.dto';
import {
  SignatureFieldView,
  SignatureStateDto,
} from './dto/signature-response.dto';

/**
 * Online signing for a request. The PDF/DOCX is reused from Document (no
 * duplication); this service owns only the overlay (SignatureField) and the
 * per-approver sign state, and drives the approval engine when an approver
 * signs or rejects through the document.
 */
@Injectable()
export class SignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ApprovalEngineService,
  ) {}

  /** Read the signing document + boxes for a request (any involved user). */
  async getForRequest(
    userId: string,
    requestId: string,
  ): Promise<SignatureStateDto> {
    const request = await this.loadRequest(requestId);
    await this.assertCanView(request, userId);

    const fields = await this.prisma.signatureField.findMany({
      where: { responseId: requestId },
      orderBy: [{ page: 'asc' }, { y: 'asc' }],
    });
    return {
      documentId: await this.signingDocumentId(requestId),
      fields: fields.map((f) => SignatureFieldView.fromEntity(f)),
    };
  }

  /**
   * Replace the signing document + all boxes ("from scratch"). Owner-only,
   * while the request is still open (DRAFT / PENDING / REQUEST_CHANGES). Wipes
   * any existing positions and per-approver sign state.
   */
  async setFields(
    userId: string,
    requestId: string,
    dto: SetSignatureDto,
  ): Promise<SignatureStateDto> {
    const request = await this.loadRequest(requestId);
    if (request.createdById !== userId) {
      throw new ForbiddenException('Only the requestor can place signatures');
    }
    if (
      request.status !== RequestStatus.DRAFT &&
      request.status !== RequestStatus.PENDING &&
      request.status !== RequestStatus.REQUEST_CHANGES
    ) {
      throw new BadRequestException(
        'Signature positions can only be changed on an open request',
      );
    }

    const documentId = dto.documentId?.trim() || null;

    if (documentId) {
      const link = await this.prisma.requestDocument.findFirst({
        where: { responseId: requestId, documentId },
        include: { document: true },
      });
      if (!link || link.document.deletedFlag) {
        throw new BadRequestException(
          'The signing document must be attached to this request',
        );
      }
      if (dto.fields.length === 0) {
        throw new BadRequestException(
          'Place at least one signature box on the signing document',
        );
      }
      // Every box must target a real, active user.
      const assigneeIds = [...new Set(dto.fields.map((f) => f.assigneeId))];
      const users = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds }, isActive: true },
        select: { id: true },
      });
      const valid = new Set(users.map((u) => u.id));
      const unknown = assigneeIds.filter((id) => !valid.has(id));
      if (unknown.length) {
        throw new BadRequestException(
          'Some signature boxes target users who do not exist',
        );
      }
    } else if (dto.fields.length > 0) {
      throw new BadRequestException(
        'A signing document is required to place signature boxes',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Reset designation + positions, then re-apply from scratch.
      await tx.signatureField.deleteMany({ where: { responseId: requestId } });
      await tx.requestDocument.updateMany({
        where: { responseId: requestId },
        data: { signing: false },
      });
      if (documentId) {
        await tx.requestDocument.updateMany({
          where: { responseId: requestId, documentId },
          data: { signing: true },
        });
        await tx.signatureField.createMany({
          data: dto.fields.map((f) => ({
            responseId: requestId,
            documentId,
            assigneeId: f.assigneeId,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
          })),
        });
      }
    });

    return this.getForRequest(userId, requestId);
  }

  /**
   * Sign as the current approver: stamp the caller's boxes with their reusable
   * profile signature, then mark their approval task done (APPROVE) so the flow
   * advances. The step only completes once every approver has signed (enforced
   * by the engine + the per-step completion rule).
   */
  async sign(userId: string, requestId: string): Promise<FlowStatusDto> {
    const request = await this.loadRequest(requestId);

    const myFields = await this.prisma.signatureField.findMany({
      where: { responseId: requestId, assigneeId: userId },
    });
    if (myFields.length === 0) {
      throw new BadRequestException(
        'You have no signature position on this document',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.signatureImage || !user?.signatureName) {
      throw new BadRequestException('SIGNATURE_PROFILE_INCOMPLETE');
    }

    await this.prisma.signatureField.updateMany({
      where: {
        responseId: requestId,
        assigneeId: userId,
        status: { not: SignatureStatus.SIGNED },
      },
      data: {
        status: SignatureStatus.SIGNED,
        signatureName: user.signatureName,
        signatureImage: user.signatureImage,
        signedAt: new Date(),
      },
    });

    // Advance the approval flow (engine re-checks all boxes are signed).
    return this.engine.act(userId, request.id, TaskAction.APPROVE);
  }

  /**
   * Reject through the document (approver "cancel" duty): mark the caller's
   * pending boxes REJECTED, then reject the request via the engine.
   */
  async reject(userId: string, requestId: string): Promise<FlowStatusDto> {
    const request = await this.loadRequest(requestId);
    await this.prisma.signatureField.updateMany({
      where: {
        responseId: requestId,
        assigneeId: userId,
        status: SignatureStatus.PENDING,
      },
      data: { status: SignatureStatus.REJECTED, signedAt: new Date() },
    });
    return this.engine.act(userId, request.id, TaskAction.REJECT);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Mark all still-pending boxes on a request as REJECTED (clone/cancel). */
  static rejectPending(
    tx: Prisma.TransactionClient,
    responseId: string,
  ): Promise<unknown> {
    return tx.signatureField.updateMany({
      where: { responseId, status: SignatureStatus.PENDING },
      data: { status: SignatureStatus.REJECTED, signedAt: new Date() },
    });
  }

  private async signingDocumentId(requestId: string): Promise<string | null> {
    const link = await this.prisma.requestDocument.findFirst({
      where: { responseId: requestId, signing: true },
      select: { documentId: true },
    });
    return link?.documentId ?? null;
  }

  private async loadRequest(requestId: string) {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  private async assertCanView(
    request: { id: string; createdById: string },
    userId: string,
  ): Promise<void> {
    if (request.createdById === userId) return;
    const [assignee, viewer] = await Promise.all([
      this.prisma.flowAssignee.findFirst({
        where: {
          userId,
          step: { flow: { instances: { some: { responseId: request.id } } } },
        },
        select: { id: true },
      }),
      this.prisma.requestViewer.findFirst({
        where: { responseId: request.id, userId },
        select: { id: true },
      }),
    ]);
    if (!assignee && !viewer) {
      throw new ForbiddenException('You cannot view this request');
    }
  }
}

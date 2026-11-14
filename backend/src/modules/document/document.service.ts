import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import {
  DocumentType,
  RequestDocSection,
  RequestStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DocumentStorageService } from './document-storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentResponseDto } from './dto/document-response.dto';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentStorageService,
  ) {}

  /** Persist an uploaded file and optionally link it to a request. */
  async upload(
    userId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ): Promise<DocumentResponseDto> {
    const section = dto.section ?? RequestDocSection.SECONDARY;
    if (dto.requestId) {
      const request = await this.prisma.formResponse.findUnique({
        where: { id: dto.requestId },
        select: { id: true, createdById: true, status: true },
      });
      if (!request) {
        throw new NotFoundException('Request to attach not found');
      }

      const isOwner = request.createdById === userId;
      if (section === RequestDocSection.MAIN) {
        // MAIN documents are core content: only the creator may add them, and
        // only in craft mode (a DRAFT) — they are locked once submitted.
        if (!isOwner) {
          throw new ForbiddenException(
            'Only the requestor can manage main documents',
          );
        }
        if (
          request.status !== RequestStatus.DRAFT &&
          request.status !== RequestStatus.REQUEST_CHANGES
        ) {
          throw new ForbiddenException(
            'Main documents can only be changed while the request is a draft or awaiting revision',
          );
        }
      } else {
        // SECONDARY documents are supporting files (this also covers comment
        // attachments): anyone with access to the request — creator, approval
        // assignee, or viewer — may add them at any time, regardless of status.
        if (
          !isOwner &&
          !(await this.isApprovalAssignee(request.id, userId)) &&
          !(await this.isViewer(request.id, userId))
        ) {
          throw new ForbiddenException(
            'You cannot attach documents to this request',
          );
        }
      }
    }

    // Persist the bytes via the configured driver (disk or MinIO/S3). The
    // returned locator is stored in filePath and resolved again on download.
    const filePath = await this.storage.save(file, {
      requestorId: userId,
      requestId: dto.requestId,
    });

    const doc = await this.prisma.document.create({
      data: {
        name: dto.name ?? file.originalname,
        filePath,
        mimeType: file.mimetype,
        size: file.size,
        type: dto.type ?? DocumentType.NORMAL,
        createdById: userId,
        requestLinks: dto.requestId
          ? { create: { responseId: dto.requestId, section } }
          : undefined,
      },
    });
    return DocumentResponseDto.fromEntity(doc);
  }

  /**
   * Remove a document attached to a request (detach the link + soft-delete the
   * file). Creator-only for both sections; MAIN documents may only be removed
   * while the request is still a DRAFT (craft mode). The signing document is
   * managed through the signing flow, not here.
   */
  async detachFromRequest(
    userId: string,
    requestId: string,
    documentId: string,
  ): Promise<void> {
    const link = await this.prisma.requestDocument.findFirst({
      where: { responseId: requestId, documentId },
      include: {
        response: { select: { createdById: true, status: true } },
        document: { select: { createdById: true } },
      },
    });
    if (!link) {
      throw new NotFoundException('Document is not attached to this request');
    }
    if (link.signing) {
      throw new BadRequestException(
        'The signing document is managed through the signing flow',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === 'admin';
    const isOwner = link.response.createdById === userId;
    const isUploader = link.document?.createdById === userId;

    if (!isAdmin && !isOwner && !isUploader) {
      throw new ForbiddenException(
        'Only the requestor or the document uploader can remove documents',
      );
    }

    // MAIN documents are locked once submitted — removable only in craft mode
    // (DRAFT) or when awaiting revision (REQUEST_CHANGES). SECONDARY documents may be removed by the creator or uploader at any time.
    if (
      link.section === RequestDocSection.MAIN &&
      link.response.status !== RequestStatus.DRAFT &&
      link.response.status !== RequestStatus.REQUEST_CHANGES
    ) {
      throw new ForbiddenException(
        'Main documents can only be changed while the request is a draft or awaiting revision',
      );
    }

    await this.prisma.$transaction([
      this.prisma.requestDocument.delete({ where: { id: link.id } }),
      this.prisma.document.update({
        where: { id: documentId },
        data: { deletedFlag: true, deletedAt: new Date() },
      }),
    ]);
  }

  async updateName(
    userId: string,
    id: string,
    name: string,
  ): Promise<DocumentResponseDto> {
    const doc = await this.getActiveOwned(userId, id);
    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data: { name },
    });
    return DocumentResponseDto.fromEntity(updated);
  }

  /** Document metadata by id (any authenticated user). */
  async getOne(id: string): Promise<DocumentResponseDto> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.deletedFlag) {
      throw new NotFoundException('Document not found');
    }
    return DocumentResponseDto.fromEntity(doc);
  }

  /** Load the document row (incl. filePath locator) for streaming a download. */
  async getForDownload(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.deletedFlag) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }

  /** Open the file bytes for a document via the configured storage driver. */
  openStream(filePath: string): Promise<Readable> {
    return this.storage.openStream(filePath);
  }

  /** Soft delete — flips deletedFlag; the file stays on disk. */
  async softDelete(userId: string, id: string): Promise<void> {
    const doc = await this.getActiveOwned(userId, id);
    await this.prisma.document.update({
      where: { id: doc.id },
      data: { deletedFlag: true, deletedAt: new Date() },
    });
  }

  /** Hard delete — admin only. Removes links, row, and the file from disk. */
  async hardDelete(id: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    await this.prisma.$transaction([
      this.prisma.requestDocument.deleteMany({ where: { documentId: id } }),
      this.prisma.document.delete({ where: { id } }),
    ]);
    // Best-effort file removal; a missing file should not fail the request.
    try {
      await this.storage.remove(doc.filePath);
    } catch (err) {
      this.logger.warn(`Could not delete file ${doc.filePath}: ${String(err)}`);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /**
   * Whether a user is authorized as an approver / assignee on the request —
   * supports both Procedure BPMN Runtime (TaskProjection, ActualActor, SignatureField)
   * and Legacy Flow (FlowAssignee), as well as system admins.
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

  /** Whether a user is on the request's viewable list. */
  private async isViewer(
    responseId: string,
    userId: string,
  ): Promise<boolean> {
    const viewer = await this.prisma.requestViewer.findUnique({
      where: { responseId_userId: { responseId, userId } },
      select: { id: true },
    });
    return !!viewer;
  }

  /** Load a non-deleted document owned by the user, or throw. */
  private async getActiveOwned(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.deletedFlag) {
      throw new NotFoundException('Document not found');
    }
    if (doc.createdById !== userId) {
      throw new ForbiddenException('You can only modify your own documents');
    }
    return doc;
  }
}

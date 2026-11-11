import { Readable } from 'stream';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SigningEnvelopeStatus,
  SigningRecipientStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DocumensoClient } from './documenso.client';
import { StorageClient } from './storage.client';
import { AddFieldDto } from './dto/add-field.dto';
import { EnvelopeResponseDto } from './dto/envelope-response.dto';
import type { EnvelopeRole } from './dto/list-envelopes-query.dto';

const ENVELOPE_INCLUDE = {
  recipients: { orderBy: { createdAt: 'asc' } },
  fields: true,
} satisfies Prisma.SigningEnvelopeInclude;

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documenso: DocumensoClient,
    private readonly storage: StorageClient,
  ) {}

  // ── Owner: create envelope from an uploaded PDF ──────────────────────────
  async createEnvelope(
    ownerId: string,
    file: Express.Multer.File,
    title: string | undefined,
  ): Promise<EnvelopeResponseDto> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported');
    }

    const docTitle = title?.trim() || file.originalname;

    // 1. Create the Documenso draft + presigned upload URL.
    const created = await this.documenso.createDocument(docTitle);

    // 2. Upload the PDF bytes straight to MinIO at the same key.
    const key = this.storage.keyFromPresignedUrl(created.uploadUrl);
    await this.storage.putObject(key, file.buffer, 'application/pdf');

    // 3. Persist our envelope.
    const envelope = await this.prisma.signingEnvelope.create({
      data: {
        title: docTitle,
        documensoDocumentId: created.documentId,
        bucketKey: key,
        ownerId,
        status: SigningEnvelopeStatus.DRAFT,
      },
      include: ENVELOPE_INCLUDE,
    });

    return EnvelopeResponseDto.fromEntity(envelope, ownerId);
  }

  // ── Owner: add an assignee (gafood user) as a signer ─────────────────────
  async addRecipient(
    ownerId: string,
    envelopeId: string,
    assigneeUserId: string,
  ): Promise<EnvelopeResponseDto> {
    const envelope = await this.getDraftOwned(ownerId, envelopeId);

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeUserId },
      select: { id: true, email: true, displayName: true },
    });
    if (!assignee) {
      throw new NotFoundException('Assignee user not found');
    }

    const existing = await this.prisma.signingRecipient.findUnique({
      where: {
        envelopeId_userId: { envelopeId, userId: assigneeUserId },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('User is already a signer on this envelope');
    }

    const name = assignee.displayName?.trim() || assignee.email;

    const recipient = await this.documenso.createRecipient(
      envelope.documensoDocumentId,
      { name, email: assignee.email, role: 'SIGNER' },
    );

    await this.prisma.signingRecipient.create({
      data: {
        envelopeId,
        userId: assignee.id,
        documensoRecipientId: recipient.id ?? recipient.recipientId ?? 0,
        email: assignee.email,
        name,
        token: recipient.token,
        signingUrl: recipient.signingUrl,
      },
    });

    return this.getEnvelopeOrThrow(ownerId, envelopeId);
  }

  // ── Owner: place a signature field for a recipient ───────────────────────
  async addField(
    ownerId: string,
    envelopeId: string,
    dto: AddFieldDto,
  ): Promise<EnvelopeResponseDto> {
    const envelope = await this.getDraftOwned(ownerId, envelopeId);

    const recipient = await this.prisma.signingRecipient.findFirst({
      where: { id: dto.recipientId, envelopeId },
    });
    if (!recipient) {
      throw new NotFoundException('Recipient not found on this envelope');
    }

    const result = await this.documenso.createFields(
      envelope.documensoDocumentId,
      [
        {
          recipientId: recipient.documensoRecipientId,
          type: 'SIGNATURE',
          pageNumber: dto.page,
          pageX: dto.x,
          pageY: dto.y,
          pageWidth: dto.width,
          pageHeight: dto.height,
          fieldMeta: {},
        },
      ],
    );

    await this.prisma.signingField.create({
      data: {
        envelopeId,
        recipientId: recipient.id,
        documensoFieldId: extractFieldId(result),
        page: dto.page,
        x: dto.x,
        y: dto.y,
        width: dto.width,
        height: dto.height,
      },
    });

    return this.getEnvelopeOrThrow(ownerId, envelopeId);
  }

  // ── Owner: send for signing ──────────────────────────────────────────────
  async sendEnvelope(
    ownerId: string,
    envelopeId: string,
  ): Promise<EnvelopeResponseDto> {
    const envelope = await this.getDraftOwned(ownerId, envelopeId);

    const recipients = await this.prisma.signingRecipient.findMany({
      where: { envelopeId },
      include: { fields: { select: { id: true } } },
    });

    if (recipients.length === 0) {
      throw new BadRequestException('Add at least one signer before sending');
    }
    const missing = recipients.filter((r) => r.fields.length === 0);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Every signer needs at least one signature field. Missing: ${missing
          .map((r) => r.name)
          .join(', ')}`,
      );
    }

    await this.documenso.sendDocument(envelope.documensoDocumentId);

    await this.prisma.signingEnvelope.update({
      where: { id: envelopeId },
      data: { status: SigningEnvelopeStatus.PENDING },
    });

    return this.getEnvelopeOrThrow(ownerId, envelopeId);
  }

  // ── List / detail ────────────────────────────────────────────────────────
  async listEnvelopes(
    userId: string,
    role: EnvelopeRole = 'viewer',
  ): Promise<EnvelopeResponseDto[]> {
    const where: Prisma.SigningEnvelopeWhereInput =
      role === 'owner'
        ? { ownerId: userId }
        : role === 'assignee'
          ? { recipients: { some: { userId } } }
          : {
              OR: [
                { ownerId: userId },
                { recipients: { some: { userId } } },
              ],
            };

    const envelopes = await this.prisma.signingEnvelope.findMany({
      where,
      include: ENVELOPE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // Refresh any in-flight envelopes so statuses are current.
    await Promise.all(
      envelopes
        .filter((e) => e.status === SigningEnvelopeStatus.PENDING)
        .map((e) => this.syncStatus(e.id, e.documensoDocumentId)),
    );

    if (!envelopes.some((e) => e.status === SigningEnvelopeStatus.PENDING)) {
      return envelopes.map((e) => EnvelopeResponseDto.fromEntity(e, userId));
    }

    // Re-read to reflect any status changes.
    const fresh = await this.prisma.signingEnvelope.findMany({
      where,
      include: ENVELOPE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return fresh.map((e) => EnvelopeResponseDto.fromEntity(e, userId));
  }

  async getEnvelopeOrThrow(
    userId: string,
    envelopeId: string,
  ): Promise<EnvelopeResponseDto> {
    const envelope = await this.loadWithAccess(userId, envelopeId);

    if (envelope.status === SigningEnvelopeStatus.PENDING) {
      await this.syncStatus(envelope.id, envelope.documensoDocumentId);
      const fresh = await this.prisma.signingEnvelope.findUnique({
        where: { id: envelopeId },
        include: ENVELOPE_INCLUDE,
      });
      if (fresh) {
        return EnvelopeResponseDto.fromEntity(fresh, userId);
      }
    }

    return EnvelopeResponseDto.fromEntity(envelope, userId);
  }

  // ── Download (any involved user) ─────────────────────────────────────────
  async getDownload(
    userId: string,
    envelopeId: string,
  ): Promise<{ stream: Readable; filename: string }> {
    const envelope = await this.loadWithAccess(userId, envelopeId);

    if (envelope.status === SigningEnvelopeStatus.PENDING) {
      await this.syncStatus(envelope.id, envelope.documensoDocumentId);
    }

    const completed = await this.prisma.signingEnvelope.findUnique({
      where: { id: envelopeId },
      select: { status: true },
    });

    // Documenso only produces a sealed (signatures-flattened) PDF once the
    // document is COMPLETED. Before that we serve the original.
    const wantOriginal = completed?.status !== SigningEnvelopeStatus.COMPLETED;

    const { downloadUrl } = await this.documenso.getDownloadUrl(
      envelope.documensoDocumentId,
      wantOriginal,
    );
    const key = this.storage.keyFromPresignedUrl(downloadUrl);
    const { body } = await this.storage.getObject(key);

    const suffix = wantOriginal ? '' : '-signed';
    const base = envelope.title.replace(/\.pdf$/i, '');
    return { stream: body, filename: `${base}${suffix}.pdf` };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Pull recipient signing status from Documenso and persist changes. */
  private async syncStatus(
    envelopeId: string,
    documensoDocumentId: number,
  ): Promise<void> {
    try {
      const doc = await this.documenso.getDocument(documensoDocumentId);
      const byId = new Map(
        (doc.recipients ?? []).map((r) => [r.id ?? r.recipientId, r]),
      );

      const recipients = await this.prisma.signingRecipient.findMany({
        where: { envelopeId },
      });

      for (const r of recipients) {
        const remote = byId.get(r.documensoRecipientId);
        const signed = remote?.signingStatus === 'SIGNED';
        if (signed && r.status !== SigningRecipientStatus.SIGNED) {
          await this.prisma.signingRecipient.update({
            where: { id: r.id },
            data: {
              status: SigningRecipientStatus.SIGNED,
              signedAt: remote?.signedAt ? new Date(remote.signedAt) : new Date(),
            },
          });
        }
      }

      const fresh = await this.prisma.signingRecipient.findMany({
        where: { envelopeId },
        select: { status: true },
      });
      const allSigned =
        fresh.length > 0 &&
        fresh.every((r) => r.status === SigningRecipientStatus.SIGNED);

      if (allSigned) {
        await this.prisma.signingEnvelope.update({
          where: { id: envelopeId },
          data: { status: SigningEnvelopeStatus.COMPLETED },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Status sync failed for envelope ${envelopeId}: ${String(err)}`,
      );
    }
  }

  private async getDraftOwned(ownerId: string, envelopeId: string) {
    const envelope = await this.prisma.signingEnvelope.findUnique({
      where: { id: envelopeId },
    });
    if (!envelope) {
      throw new NotFoundException('Envelope not found');
    }
    if (envelope.ownerId !== ownerId) {
      throw new ForbiddenException('You can only modify your own envelopes');
    }
    if (envelope.status !== SigningEnvelopeStatus.DRAFT) {
      throw new BadRequestException(
        'Envelope has already been sent and can no longer be edited',
      );
    }
    return envelope;
  }

  private async loadWithAccess(userId: string, envelopeId: string) {
    const envelope = await this.prisma.signingEnvelope.findUnique({
      where: { id: envelopeId },
      include: ENVELOPE_INCLUDE,
    });
    if (!envelope) {
      throw new NotFoundException('Envelope not found');
    }
    const involved =
      envelope.ownerId === userId ||
      envelope.recipients.some((r) => r.userId === userId);
    if (!involved) {
      throw new ForbiddenException('You do not have access to this envelope');
    }
    return envelope;
  }
}

/** Best-effort extraction of the created Documenso field id from a response. */
function extractFieldId(result: unknown): number {
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0] as { id?: number };
    return typeof first?.id === 'number' ? first.id : 0;
  }
  const obj = result as { id?: number; fields?: { id?: number }[] };
  if (typeof obj?.id === 'number') return obj.id;
  if (Array.isArray(obj?.fields) && typeof obj.fields[0]?.id === 'number') {
    return obj.fields[0].id as number;
  }
  return 0;
}

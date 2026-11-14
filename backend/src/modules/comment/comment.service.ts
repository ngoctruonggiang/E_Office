import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentDto } from './dto/comment-response.dto';
import { CommentCountDto } from './dto/comment-count.dto';

/** Comment row joined with everything needed to build a CommentDto. */
const commentInclude = {
  author: { select: { id: true, email: true, displayName: true } },
  attachments: {
    include: { document: { select: { id: true, name: true } } },
  },
  reactions: { select: { userId: true } },
} satisfies Prisma.RequestCommentInclude;

type CommentRow = Prisma.RequestCommentGetPayload<{
  include: typeof commentInclude;
}>;

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  /** List a request's comments as a thread (top-level + nested replies). */
  async list(
    userId: string,
    requestId: string,
    stepOrder?: number,
  ): Promise<CommentDto[]> {
    await this.assertCanAccess(userId, requestId);

    const rows = await this.prisma.requestComment.findMany({
      where: { responseId: requestId, stepOrder: stepOrder ?? null },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });

    return this.toTree(rows, userId);
  }

  /**
   * Non-deleted comment counts grouped by step (and the request feed, stepOrder
   * null) in a single query — drives the comment-count badges in the flow view.
   * Replies inherit their parent's stepOrder, so they are counted too.
   */
  async counts(
    userId: string,
    requestId: string,
  ): Promise<CommentCountDto[]> {
    await this.assertCanAccess(userId, requestId);

    const rows = await this.prisma.requestComment.groupBy({
      by: ['stepOrder'],
      where: { responseId: requestId, deletedFlag: false },
      _count: { _all: true },
    });

    return rows.map((r) => ({ stepOrder: r.stepOrder, count: r._count._all }));
  }

  /** Post a comment (or a reply / step note) on a request. */
  async create(
    userId: string,
    requestId: string,
    dto: CreateCommentDto,
  ): Promise<CommentDto> {
    await this.assertCanAccess(userId, requestId);

    // A reply must point at a comment on the same request; it inherits the
    // parent's step scope so a thread can't span the feed and a step popup.
    let stepOrder = dto.stepOrder ?? null;
    if (dto.parentId) {
      const parent = await this.prisma.requestComment.findUnique({
        where: { id: dto.parentId },
        select: { responseId: true, stepOrder: true },
      });
      if (!parent || parent.responseId !== requestId) {
        throw new BadRequestException(
          'Parent comment not found on this request',
        );
      }
      stepOrder = parent.stepOrder;
    }

    await this.assertAttachmentsBelong(requestId, dto.attachmentDocumentIds);

    const created = await this.prisma.requestComment.create({
      data: {
        responseId: requestId,
        authorId: userId,
        parentId: dto.parentId ?? null,
        stepOrder,
        body: dto.body,
        attachments: dto.attachmentDocumentIds?.length
          ? {
              create: dto.attachmentDocumentIds.map((documentId) => ({
                documentId,
              })),
            }
          : undefined,
      },
      include: commentInclude,
    });
    return this.toDto(created, userId);
  }

  /** Edit a comment's text — author only. */
  async update(
    userId: string,
    requestId: string,
    commentId: string,
    body: string,
  ): Promise<CommentDto> {
    await this.assertCanAccess(userId, requestId);
    const comment = await this.getOwned(requestId, commentId, userId);
    if (comment.deletedFlag) {
      throw new BadRequestException('A deleted comment cannot be edited');
    }
    const updated = await this.prisma.requestComment.update({
      where: { id: comment.id },
      data: { body, edited: true },
      include: commentInclude,
    });
    return this.toDto(updated, userId);
  }

  /** Soft-delete a comment — author or admin. Replies are kept. */
  async remove(
    userId: string,
    role: string,
    requestId: string,
    commentId: string,
  ): Promise<void> {
    await this.assertCanAccess(userId, requestId);
    const comment = await this.prisma.requestComment.findUnique({
      where: { id: commentId },
      select: { id: true, responseId: true, authorId: true },
    });
    if (!comment || comment.responseId !== requestId) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && role !== 'admin') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.requestComment.update({
      where: { id: comment.id },
      data: { deletedFlag: true, body: '' },
    });
  }

  /** Toggle the caller's like on a comment; returns the updated comment. */
  async toggleLike(
    userId: string,
    requestId: string,
    commentId: string,
  ): Promise<CommentDto> {
    await this.assertCanAccess(userId, requestId);
    const comment = await this.prisma.requestComment.findUnique({
      where: { id: commentId },
      select: { id: true, responseId: true },
    });
    if (!comment || comment.responseId !== requestId) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.commentReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.commentReaction.create({
        data: { commentId, userId },
      });
    }

    const updated = await this.prisma.requestComment.findUniqueOrThrow({
      where: { id: commentId },
      include: commentInclude,
    });
    return this.toDto(updated, userId);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /**
   * Who may read/post on a request: the creator, a viewer, or any flow
   * assignee — i.e. anyone who can open the detail. Throws 404 if the request
   * doesn't exist, 403 if the user has no access. Mirrors the relation paths
   * used in RequestService.
   */
  private async assertCanAccess(
    userId: string,
    requestId: string,
  ): Promise<void> {
    const request = await this.prisma.formResponse.findUnique({
      where: { id: requestId },
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'admin') {
      return;
    }

    const allowed = await this.prisma.formResponse.findFirst({
      where: {
        id: requestId,
        OR: [
          { createdById: userId },
          { viewers: { some: { userId } } },
          {
            flowInstance: {
              flow: { steps: { some: { assignees: { some: { userId } } } } },
            },
          },
          { actualActors: { some: { userId } } },
          { projectedTasks: { some: { assigneeId: userId } } },
          { signatureFields: { some: { assigneeId: userId } } },
        ],
      },
      select: { id: true },
    });
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this request');
    }
  }

  /** Load a comment owned by the user on this request, or throw. */
  private async getOwned(requestId: string, commentId: string, userId: string) {
    const comment = await this.prisma.requestComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.responseId !== requestId) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    return comment;
  }

  /**
   * Attachments must be live documents linked to this request (uploaded via
   * /documents/upload with the requestId), so a comment can't reference files
   * from another request.
   */
  private async assertAttachmentsBelong(
    requestId: string,
    documentIds?: string[],
  ): Promise<void> {
    if (!documentIds?.length) return;
    const linked = await this.prisma.requestDocument.findMany({
      where: {
        responseId: requestId,
        documentId: { in: documentIds },
        document: { deletedFlag: false },
      },
      select: { documentId: true },
    });
    const ok = new Set(linked.map((l) => l.documentId));
    if (documentIds.some((id) => !ok.has(id))) {
      throw new BadRequestException(
        'All attachments must be documents attached to this request',
      );
    }
  }

  /** Build the nested reply tree from a flat, time-ordered comment list. */
  private toTree(rows: CommentRow[], userId: string): CommentDto[] {
    const dtoById = new Map<string, CommentDto>();
    for (const row of rows) {
      dtoById.set(row.id, this.toDto(row, userId));
    }
    const roots: CommentDto[] = [];
    for (const row of rows) {
      const dto = dtoById.get(row.id)!;
      const parent = row.parentId ? dtoById.get(row.parentId) : null;
      if (parent) parent.replies.push(dto);
      else roots.push(dto);
    }
    return roots;
  }

  private toDto(row: CommentRow, userId: string): CommentDto {
    return {
      id: row.id,
      responseId: row.responseId,
      authorId: row.authorId,
      author: row.author,
      parentId: row.parentId,
      stepOrder: row.stepOrder,
      body: row.body,
      edited: row.edited,
      deleted: row.deletedFlag,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      likeCount: row.reactions.length,
      likedByMe: row.reactions.some((r) => r.userId === userId),
      attachments: row.attachments.map((a) => ({
        id: a.id,
        documentId: a.documentId,
        name: a.document.name,
      })),
      replies: [],
    };
  }
}

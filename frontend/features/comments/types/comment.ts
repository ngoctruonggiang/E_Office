// Mirrors be CommentDto (comment/dto/comment-response.dto.ts).

export type CommentAttachment = {
  id: string;
  documentId: string;
  name: string;
};

export type CommentAuthor = {
  id: string;
  email: string;
  displayName: string | null;
};

export type Comment = {
  id: string;
  responseId: string;
  authorId: string;
  author: CommentAuthor;
  parentId: string | null;
  /** null = request-level feed; otherwise the approval step order. */
  stepOrder: number | null;
  body: string;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  likedByMe: boolean;
  attachments: CommentAttachment[];
  replies: Comment[];
};

/** Non-deleted comment count for one scope (a step, or the feed when null). */
export type CommentCount = {
  stepOrder: number | null;
  count: number;
};

/** Payload for creating a comment / reply / step note. */
export type CreateCommentInput = {
  body: string;
  parentId?: string;
  stepOrder?: number;
  attachmentDocumentIds?: string[];
};

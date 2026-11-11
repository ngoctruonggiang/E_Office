import { apiFetch } from "@/lib/api/client";
import type {
  Comment,
  CommentCount,
  CreateCommentInput,
} from "../types/comment";

/**
 * List a request's comments as a thread. Omit `stepOrder` for the request-level
 * feed; pass a step's order for that step's thread (GET
 * /requests/:id/comments[?stepOrder=]).
 */
export function listComments(
  requestId: string,
  stepOrder?: number,
): Promise<Comment[]> {
  const query = stepOrder != null ? `?stepOrder=${stepOrder}` : "";
  return apiFetch<Comment[]>(`/requests/${requestId}/comments${query}`);
}

/**
 * Non-deleted comment counts grouped by step (and the request feed, stepOrder
 * null) — one round-trip for all the flow's comment-count badges (GET
 * /requests/:id/comments/counts).
 */
export function listCommentCounts(requestId: string): Promise<CommentCount[]> {
  return apiFetch<CommentCount[]>(`/requests/${requestId}/comments/counts`);
}

/** Post a comment, reply, or step note (POST /requests/:id/comments). */
export function createComment(
  requestId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  return apiFetch<Comment>(`/requests/${requestId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Edit a comment's text — author only (PATCH /requests/:id/comments/:commentId). */
export function updateComment(
  requestId: string,
  commentId: string,
  body: string,
): Promise<Comment> {
  return apiFetch<Comment>(`/requests/${requestId}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

/** Delete a comment — author or admin (DELETE /requests/:id/comments/:commentId). */
export function deleteComment(
  requestId: string,
  commentId: string,
): Promise<void> {
  return apiFetch<void>(`/requests/${requestId}/comments/${commentId}`, {
    method: "DELETE",
  });
}

/** Toggle the caller's like on a comment (POST /requests/:id/comments/:commentId/like). */
export function toggleCommentLike(
  requestId: string,
  commentId: string,
): Promise<Comment> {
  return apiFetch<Comment>(
    `/requests/${requestId}/comments/${commentId}/like`,
    { method: "POST" },
  );
}

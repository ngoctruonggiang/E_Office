"use client";

import { useState } from "react";
import { Paperclip, ThumbsUp } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { downloadDocument } from "@/features/documents/api/documents";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import {
  deleteComment,
  toggleCommentLike,
  updateComment,
} from "../api/comments";
import type { Comment } from "../types/comment";
import { Avatar } from "./Avatar";
import { CommentComposer } from "./CommentComposer";

/** One comment with its like/reply/edit/delete actions and nested replies. */
export function CommentItem({
  comment,
  requestId,
  currentUserId,
  onChanged,
  depth = 0,
}: {
  comment: Comment;
  requestId: string;
  currentUserId: string;
  onChanged: () => void;
  depth?: number;
}) {
  const t = useT();
  const [locale] = useLocale();
  const { open } = useModal();
  const { notify } = useNotifications();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const isOwn = comment.authorId === currentUserId;
  const name = comment.author.displayName ?? comment.author.email;

  const fail = (err: unknown) =>
    notify({
      title: t("toast.actionFailed"),
      message:
        err instanceof ApiError || err instanceof Error ? err.message : "",
      kind: "error",
    });

  const like = async () => {
    setBusy(true);
    try {
      await toggleCommentLike(requestId, comment.id);
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editBody.trim()) return;
    setBusy(true);
    try {
      await updateComment(requestId, comment.id, editBody.trim());
      setEditing(false);
      notify({ title: t("comments.updated"), kind: "success" });
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    open(
      <ConfirmDialog
        title={t("comments.deleteConfirmTitle")}
        description={t("comments.deleteConfirmDesc")}
        confirmLabel={t("comments.delete")}
        tone="danger"
        onConfirm={async () => {
          try {
            await deleteComment(requestId, comment.id);
            notify({ title: t("comments.removed"), kind: "success" });
            onChanged();
          } catch (err) {
            fail(err);
          }
        }}
      />,
    );

  return (
    <div className="flex gap-2.5">
      <Avatar name={name} seed={comment.authorId} size="sm" />
      <div className="min-w-0 flex-1">
        {/* Bubble */}
        {comment.deleted ? (
          <div className="rounded-2xl bg-muted/60 px-3 py-2 text-sm italic text-muted-foreground">
            {t("comments.deleted")}
          </div>
        ) : editing ? (
          <div className="space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={busy}
                disabled={!editBody.trim()}
                onClick={() => void saveEdit()}
              >
                {t("comments.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setEditBody(comment.body);
                }}
              >
                {t("comments.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="inline-block max-w-full rounded-2xl bg-muted px-3 py-2">
            <p className="text-xs font-semibold text-foreground">{name}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {comment.body}
            </p>
          </div>
        )}

        {/* Attachments */}
        {!comment.deleted && comment.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {comment.attachments.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => void downloadDocument(att.documentId, att.name)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                title={att.name}
              >
                <Paperclip size={12} className="text-muted-foreground" />
                <span className="max-w-[160px] truncate">{att.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action row */}
        {!comment.deleted && !editing && (
          <div className="">
            <div className="mt-1 flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
            <button
              type="button"
              disabled={busy}
              onClick={() => void like()}
              className={cn(
                "inline-flex items-center gap-1 font-medium hover:text-foreground disabled:opacity-50",
                comment.likedByMe && "text-primary hover:text-primary",
              )}
            >
              <ThumbsUp
                size={13}
                className={comment.likedByMe ? "fill-current" : undefined}
              />
              {t("comments.like")}
              {comment.likeCount > 0 && (
                <span className="ml-0.5">· {comment.likeCount}</span>
              )}
            </button>

            {/* Replies stay one level deep to keep the thread readable. */}
            {depth === 0 && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="font-medium hover:text-foreground"
              >
                {t("comments.reply")}
              </button>
            )}

            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setEditBody(comment.body);
                  }}
                  className="font-medium hover:text-foreground"
                >
                  {t("comments.edit")}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="font-medium hover:text-destructive"
                >
                  {t("comments.delete")}
                </button>
              </>
            )}

            <span>{formatDateTime(comment.createdAt, locale)}</span>
            {comment.edited && <span>· {t("comments.edited")}</span>}
          </div>
          </div>
        )}

        {/* Reply composer */}
        {replying && (
          <div className="mt-2">
            <CommentComposer
              requestId={requestId}
              parentId={comment.id}
              autoFocus
              placeholder={t("comments.replyPlaceholder")}
              onPosted={() => {
                setReplying(false);
                onChanged();
              }}
              onCancel={() => setReplying(false)}
            />
          </div>
        )}

        {/* Nested replies */}
        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l border-border pl-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                requestId={requestId}
                currentUserId={currentUserId}
                onChanged={onChanged}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

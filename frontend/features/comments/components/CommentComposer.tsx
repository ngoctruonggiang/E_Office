"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { uploadDocument } from "@/features/documents/api/documents";
import { ApiError } from "@/lib/api/client";
import { formatBytes } from "@/lib/utils/format";
import { createComment } from "../api/comments";
import type { Comment } from "../types/comment";

/**
 * Composer for a new comment, reply, or step note. Staged files are uploaded
 * (attached to the request) on submit, then their ids are sent with the comment.
 */
export function CommentComposer({
  requestId,
  stepOrder,
  parentId,
  placeholder,
  autoFocus = false,
  onPosted,
  onCancel,
}: {
  requestId: string;
  stepOrder?: number;
  parentId?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onPosted: (comment: Comment) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const { notify } = useNotifications();
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit = body.trim().length > 0 || files.length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const attachmentDocumentIds: string[] = [];
      for (const file of files) {
        const doc = await uploadDocument(file, { requestId });
        attachmentDocumentIds.push(doc.id);
      }
      const comment = await createComment(requestId, {
        body: body.trim(),
        parentId,
        stepOrder,
        attachmentDocumentIds: attachmentDocumentIds.length
          ? attachmentDocumentIds
          : undefined,
      });
      setBody("");
      setFiles([]);
      onPosted(comment);
    } catch (err) {
      notify({
        title: t("toast.actionFailed"),
        message:
          err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        // onKeyDown={(e) => {
        //   // Cmd/Ctrl+Enter submits; Enter alone keeps newlines (it's a textarea).
        //   if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        //     e.preventDefault();
        //     void submit();
        //   }
        // }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); // chặn textarea xuống dòng
            void submit();
          }
        }}
        placeholder={placeholder ?? t("comments.placeholder")}
        rows={parentId ? 2 : 3}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file, idx) => (
            <span
              key={`${file.name}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground"
            >
              <Paperclip size={11} />
              <span className="max-w-[140px] truncate">{file.name}</span>
              <span className="text-muted-foreground">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            title={t("comments.attach")}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <Paperclip size={14} />
            {t("comments.attach")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onCancel}
            >
              {t("comments.cancel")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            loading={busy}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            <Send size={14} />
            {busy ? t("comments.posting") : t("comments.post")}
          </Button>
        </div>
      </div>
    </div>
  );
}

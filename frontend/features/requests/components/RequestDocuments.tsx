"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getDocument,
  downloadDocument,
  detachRequestDocument,
  uploadDocument,
  type DocumentMeta,
  type RequestDocSection,
} from "@/features/documents/api/documents";
import { ApiError } from "@/lib/api/client";
import { formatBytes } from "@/lib/utils/format";

export function DocumentRow({
  id,
  canRemove,
  onRemove,
}: {
  id: string;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const t = useT();
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    getDocument(id)
      .then((m) => active && setMeta(m))
      .catch(() => active && setMeta(null));
    return () => {
      active = false;
    };
  }, [id]);

  const handleDownload = async () => {
    if (!meta) return;
    setDownloading(true);
    try {
      await downloadDocument(meta.id, meta.name);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <FileText size={18} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {meta?.name ?? `${id.slice(0, 8)}…`}
        </p>
        <p className="text-xs text-muted-foreground">
          {meta ? formatBytes(meta.size) : "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!meta || downloading}
        title={t("detail.download")}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {downloading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
      </button>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={t("common.delete")}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * Lists one section (MAIN / SECONDARY) of a request's attached documents with
 * per-file download. `canAdd` shows an uploader; `canRemove` shows a per-file
 * delete. Uploads are tagged with `section`; removal detaches + soft-deletes
 * the file (the backend enforces the section's add/remove rules).
 */
export function RequestDocuments({
  documentIds,
  canAdd = false,
  canRemove = false,
  requestId,
  section = "SECONDARY",
  onChanged,
}: {
  documentIds: string[];
  canAdd?: boolean;
  canRemove?: boolean;
  requestId?: string;
  section?: RequestDocSection;
  onChanged?: () => void;
}) {
  const t = useT();
  const { notify } = useNotifications();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown) =>
    notify({
      title: t("toast.actionFailed"),
      message:
        err instanceof ApiError || err instanceof Error ? err.message : "",
      kind: "error",
    });

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !requestId) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file, { requestId, section });
      }
      onChanged?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleRemove = async (id: string) => {
    if (!requestId) return;
    setBusy(true);
    try {
      await detachRequestDocument(requestId, id);
      onChanged?.();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const hasDocs = documentIds.length > 0;

  return (
    <div className="space-y-2">
      {hasDocs ? (
        documentIds.map((id) => (
          <DocumentRow
            key={id}
            id={id}
            canRemove={canRemove}
            onRemove={() => void handleRemove(id)}
          />
        ))
      ) : (
        <EmptyState compact title={t("detail.noDocuments")} />
      )}

      {canAdd && requestId && (
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={14} />
            {t("detail.addFiles")}
          </Button>
        </>
      )}
    </div>
  );
}

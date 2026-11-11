"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  X,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { ApiError } from "@/lib/api/client";
import { getSignature, rejectDocument, signDocument } from "../api/signature";
import { fetchDocumentBytes } from "../lib/fetch-bytes";
import { buildSignedPdf } from "../lib/sign-pdf";
import { PdfCanvas, type OverlayField } from "../lib/pdf-canvas";
import type { SignatureState } from "../types/signature";

const PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#16a34a",
  "#db2777",
  "#d97706",
  "#7c3aed",
  "#0d9488",
  "#dc2626",
];

export type SignDocumentMode = "approve" | "reject" | "view";

export type SignDocumentModalProps = {
  requestId: string;
  documentId: string;
  currentUserId: string;
  mode: SignDocumentMode;
  /** Called after a successful sign/reject so the detail screen can reload. */
  onActed?: () => void;
  /** Display name for downloads. */
  docName?: string;
};

export function SignDocumentModal({
  requestId,
  documentId,
  currentUserId,
  mode,
  onActed,
  docName = "document",
}: SignDocumentModalProps) {
  const t = useT();
  const router = useRouter();
  const { close } = useModal();
  const { notify } = useNotifications();
  const { resolveName } = useUserDirectory();

  const [state, setState] = useState<SignatureState | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [needProfile, setNeedProfile] = useState(false);

  const load = useCallback(async () => {
    const [sig, raw] = await Promise.all([
      getSignature(requestId),
      fetchDocumentBytes(documentId),
    ]);
    setState(sig);
    setBytes(raw);
  }, [requestId, documentId]);

  useEffect(() => {
    load().catch(() => notify({ title: t("signing.saveFailed"), kind: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Stable per-approver colors (ordered by first appearance).
  const approverOrder = useMemo(() => {
    const seen: string[] = [];
    for (const f of state?.fields ?? []) {
      if (!seen.includes(f.assigneeId)) seen.push(f.assigneeId);
    }
    return seen;
  }, [state]);

  const colorFor = useCallback(
    (id: string) => PALETTE[Math.max(0, approverOrder.indexOf(id)) % PALETTE.length],
    [approverOrder],
  );

  const overlayFields: OverlayField[] = useMemo(
    () =>
      (state?.fields ?? []).map((f) => ({
        id: f.id,
        assigneeId: f.assigneeId,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        color: colorFor(f.assigneeId),
        label: resolveName(f.assigneeId),
        signed: f.status === "SIGNED",
        signatureImage: f.signatureImage ?? undefined,
        signatureName: f.signatureName ?? undefined,
      })),
    [state, colorFor, resolveName],
  );

  const signedCount = overlayFields.filter((f) => f.signed).length;

  const refresh = async () => {
    setBusy(true);
    try {
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveBlob = (blob: Blob, suffix: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docName}${suffix}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const download = async (signed: boolean) => {
    if (!bytes) return;
    setDownloading(true);
    try {
      if (!signed) {
        saveBlob(new Blob([bytes], { type: "application/pdf" }), "");
        return;
      }
      const out = await buildSignedPdf(bytes.slice(0), overlayFields.map((field) => ({...field, color: "#000000",})));
      saveBlob(
        new Blob([out as BlobPart], { type: "application/pdf" }),
        "-signed",
      );
    } finally {
      setDownloading(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      if (mode === "reject") {
        await rejectDocument(requestId);
        notify({ title: t("signing.rejectSuccess"), kind: "success" });
      } else {
        await signDocument(requestId);
        notify({ title: t("signing.signSuccess"), kind: "success" });
      }
      onActed?.();
      close();
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error ? err.message : "";
      if (mode === "approve" && msg.includes("SIGNATURE_PROFILE_INCOMPLETE")) {
        setNeedProfile(true);
      } else {
        notify({ title: t("signing.actionFailed"), message: msg, kind: "error" });
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "approve"
      ? t("signing.approveTitle")
      : mode === "reject"
        ? t("signing.rejectTitle")
        : t("signing.viewTitle");

  // Profile-incomplete prompt: redirect to the profile page to set up a signature.
  if (needProfile) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("signing.approveTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("signing.needProfile")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setNeedProfile(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              close();
              router.push("/profile");
            }}
          >
            {t("signing.goToProfile")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-wide text-foreground">
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" disabled={busy} onClick={refresh}>
            <RefreshCw size={14} />
            {t("signing.refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={downloading || !bytes}
            onClick={() => download(false)}
          >
            <Download size={14} />
            {t("signing.downloadOriginal")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={downloading || !bytes || signedCount === 0}
            onClick={() => download(true)}
          >
            <Download size={14} />
            {t("signing.downloadSigned")}
          </Button>
        </div>
      </div>

      {/* Page navigation */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={14} />
          </Button>
          <span>{t("signing.pageOf", { page, total: pageCount })}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* Document */}
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted/20 p-3">
        {bytes ? (
          <PdfCanvas
            data={bytes}
            page={page}
            onPageCount={setPageCount}
            fields={overlayFields}
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("signing.loading")}
          </p>
        )}
      </div>

      {/* Signers */}
      {approverOrder.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {approverOrder.map((id) => {
            const f = state?.fields.find((x) => x.assigneeId === id);
            const statusKey =
              f?.status === "SIGNED"
                ? "signing.statusSigned"
                : f?.status === "REJECTED"
                  ? "signing.statusRejected"
                  : "signing.statusPending";
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorFor(id) }}
                />
                <span className="text-foreground">
                  {resolveName(id)}
                  {id === currentUserId && (
                    <span className="ml-1 text-primary">({t("common.you")})</span>
                  )}
                </span>
                <span className="text-muted-foreground">· {t(statusKey)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer: confirm (sign / reject) */}
      {mode !== "view" && (
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" disabled={busy} onClick={close}>
            <X size={15} />
            {t("common.cancel")}
          </Button>
          {mode === "reject" ? (
            <Button variant="danger" loading={busy} onClick={confirm}>
              <X size={15} />
              {busy ? t("signing.rejecting") : t("signing.reject")}
            </Button>
          ) : (
            <Button loading={busy} onClick={confirm}>
              <Check size={15} />
              {busy ? t("signing.signingInProgress") : t("signing.confirm")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

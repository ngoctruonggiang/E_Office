"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";
import {
  downloadDocument,
  documentDownloadUrl,
  getDocument,
  type DocumentMeta,
} from "@/features/documents/api/documents";
import { getSignature } from "@/features/signing/api/signature";
import { fetchDocumentBytes } from "@/features/signing/lib/fetch-bytes";
import { PdfCanvas, type OverlayField } from "@/features/signing/lib/pdf-canvas";
import { buildSignedPdf } from "@/features/signing/lib/sign-pdf";
import type { SignatureState } from "@/features/signing/types/signature";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { getAccessToken } from "@/lib/auth/storage";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const SIGNER_PALETTE = [
  "#1a3a2a",
  "#0369a1",
  "#15803d",
  "#b45309",
  "#7c3aed",
  "#be185d",
];

type PreviewItem = {
  id: string;
  kind: "SIGNING" | "MAIN" | "SECONDARY";
  badge: string;
};

type LoadedContent = {
  docId: string;
  meta: DocumentMeta | null;
  pdfBytes: ArrayBuffer | null;
  imageUrl: string | null;
  sigState: SignatureState | null;
};

function isPdf(meta: DocumentMeta | null): boolean {
  if (!meta) return false;
  return (
    meta.mimeType === "application/pdf" ||
    meta.name.toLowerCase().endsWith(".pdf")
  );
}

function isImage(meta: DocumentMeta | null): boolean {
  if (!meta) return false;
  return (
    Boolean(meta.mimeType?.startsWith("image/")) ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(meta.name)
  );
}

/**
 * Inline document preview pane for the Request Detail split-view (RAMP Sec 6.1 & 6.2).
 * Keeps controls outside the document page, preserves page proportions, and
 * supports switching between the signing PDF and attached MAIN/SECONDARY files.
 */
export function RequestDocumentPreview({
  requestId,
  signatureDocumentId,
  mainDocumentIds,
  secondaryDocumentIds,
  currentUserId,
  docName,
  onOpenFullModal,
}: {
  requestId: string;
  signatureDocumentId: string | null;
  mainDocumentIds: string[];
  secondaryDocumentIds: string[];
  currentUserId: string;
  docName: string;
  onOpenFullModal?: () => void;
}) {
  const t = useT();
  const { resolveName } = useUserDirectory();

  const items: PreviewItem[] = useMemo(() => {
    const out: PreviewItem[] = [];
    if (signatureDocumentId) {
      out.push({
        id: signatureDocumentId,
        kind: "SIGNING",
        badge: t("detail.previewSigningDoc"),
      });
    }
    for (const id of mainDocumentIds) {
      out.push({ id, kind: "MAIN", badge: t("detail.previewMainDoc") });
    }
    for (const id of secondaryDocumentIds) {
      out.push({
        id,
        kind: "SECONDARY",
        badge: t("detail.previewSecondaryDoc"),
      });
    }
    return out;
  }, [signatureDocumentId, mainDocumentIds, secondaryDocumentIds, t]);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => items[0]?.id ?? null,
  );
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<LoadedContent | null>(null);

  const activeItem =
    items.find((it) => it.id === selectedId) ?? items[0] ?? null;
  const activeId = activeItem?.id ?? null;
  const activeKind = activeItem?.kind ?? null;

  useEffect(() => {
    if (!activeId || !activeKind) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      try {
        const meta = await getDocument(activeId).catch(() => null);
        if (cancelled) return;

        let pdfBytes: ArrayBuffer | null = null;
        let imageUrl: string | null = null;
        let sigState: SignatureState | null = null;

        if (activeKind === "SIGNING" || isPdf(meta)) {
          const [bytes, sig] = await Promise.all([
            fetchDocumentBytes(activeId),
            activeKind === "SIGNING"
              ? getSignature(requestId).catch(() => null)
              : Promise.resolve(null),
          ]);
          pdfBytes = bytes;
          sigState = sig;
        } else if (isImage(meta)) {
          const res = await fetch(documentDownloadUrl(activeId), {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
          });
          if (res.ok) {
            const blob = await res.blob();
            createdUrl = URL.createObjectURL(blob);
            imageUrl = createdUrl;
          }
        }

        if (!cancelled) {
          setLoaded({ docId: activeId, meta, pdfBytes, imageUrl, sigState });
        } else if (createdUrl) {
          URL.revokeObjectURL(createdUrl);
        }
      } catch {
        if (!cancelled) {
          setLoaded({
            docId: activeId,
            meta: null,
            pdfBytes: null,
            imageUrl: null,
            sigState: null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [activeId, activeKind, requestId, nonce]);

  const approverOrder = useMemo(() => {
    const seen: string[] = [];
    for (const f of loaded?.sigState?.fields ?? []) {
      if (!seen.includes(f.assigneeId)) seen.push(f.assigneeId);
    }
    return seen;
  }, [loaded?.sigState]);

  const colorFor = useCallback(
    (id: string) =>
      SIGNER_PALETTE[
        Math.max(0, approverOrder.indexOf(id)) % SIGNER_PALETTE.length
      ],
    [approverOrder],
  );

  const overlayFields: OverlayField[] = useMemo(() => {
    if (activeKind !== "SIGNING" || loaded?.docId !== activeId) return [];
    return (loaded?.sigState?.fields ?? []).map((f) => ({
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
    }));
  }, [activeKind, activeId, loaded, colorFor, resolveName]);

  const signedCount = overlayFields.filter((f) => f.signed).length;
  const isCurrentLoaded = activeId !== null && loaded?.docId === activeId;
  const currentMeta = isCurrentLoaded ? loaded?.meta ?? null : null;
  const currentPdf = isCurrentLoaded ? loaded?.pdfBytes ?? null : null;
  const currentImg = isCurrentLoaded ? loaded?.imageUrl ?? null : null;

  const handleDownload = async (signed: boolean) => {
    if (!activeId) return;
    setDownloading(true);
    try {
      if (signed && currentPdf && overlayFields.length > 0) {
        const out = await buildSignedPdf(
          currentPdf.slice(0),
          overlayFields.map((f) => ({ ...f, color: "#000000" })),
        );
        const blob = new Blob([out as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${docName}-signed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await downloadDocument(
          activeId,
          currentMeta?.name ?? `${docName}.pdf`,
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-secondary/60 p-6">
        <EmptyState title={t("detail.previewEmpty")} />
      </div>
    );
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      {/* Document selector tabs + external toolbar controls (Sec 6.2) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3.5 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {items.map((item, idx) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setPage(1);
                  setPageCount(1);
                }}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/30 bg-surface-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-surface-secondary/70 hover:text-foreground",
                )}
              >
                <FileText size={13} />
                <span>
                  {item.badge}
                  {items.filter((x) => x.kind === item.kind).length > 1
                    ? ` #${idx + 1}`
                    : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {currentPdf && pageCount > 1 && (
            <div className="mr-1 flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer rounded p-0.5 hover:bg-surface-secondary disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="min-w-10 text-center tabular-nums">
                {page}/{pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="cursor-pointer rounded p-0.5 hover:bg-surface-secondary disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          {activeKind === "SIGNING" && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setNonce((n) => n + 1)}
              title={t("signing.refresh")}
            >
              <RefreshCw size={13} />
            </Button>
          )}

          <Button
            variant="outline"
            size="xs"
            disabled={downloading || !activeId}
            onClick={() => void handleDownload(false)}
          >
            <Download size={13} />
            {activeKind === "SIGNING"
              ? t("signing.downloadOriginal")
              : t("detail.download")}
          </Button>

          {activeKind === "SIGNING" && signedCount > 0 && (
            <Button
              variant="outline"
              size="xs"
              disabled={downloading || !currentPdf}
              onClick={() => void handleDownload(true)}
            >
              <Download size={13} />
              {t("signing.downloadSigned")}
            </Button>
          )}

          {activeKind === "SIGNING" && onOpenFullModal && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onOpenFullModal}
              title={t("detail.openSignView")}
            >
              <Maximize2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* File meta subbar */}
      {currentMeta && (
        <div className="flex items-center justify-between border-b border-border-subtle bg-surface-secondary/40 px-3.5 py-1.5 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground/85">
            {currentMeta.name}
          </span>
          <span className="shrink-0 tabular-nums">
            {formatBytes(currentMeta.size)}
          </span>
        </div>
      )}

      {/* Neutral surrounding document surface (Sec 6.2) */}
      <div className="max-h-[72vh] overflow-y-auto bg-surface-secondary/75 p-4">
        {!isCurrentLoaded ? (
          <LoadingState />
        ) : currentPdf ? (
          <div className="mx-auto max-w-2xl">
            <PdfCanvas
              data={currentPdf}
              page={page}
              onPageCount={setPageCount}
              fields={overlayFields}
            />
          </div>
        ) : currentImg ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImg}
              alt={currentMeta?.name ?? docName}
              className="max-h-[64vh] rounded border border-border bg-surface object-contain"
            />
          </div>
        ) : (
          <EmptyState
            compact
            icon={<FileText size={20} strokeWidth={1.6} />}
            title={currentMeta?.name ?? t("detail.previewTitle")}
            description={t("detail.previewUnsupported")}
            action={
              activeId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownload(false)}
                >
                  <Download size={14} />
                  {t("detail.download")}
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      {/* Compact signer status pills for signing document */}
      {activeKind === "SIGNING" && approverOrder.length > 0 && (
        <div className="border-t border-border-subtle bg-surface px-3.5 py-2.5">
          <ul className="flex flex-wrap gap-1.5">
            {approverOrder.map((id) => {
              const f = loaded?.sigState?.fields.find(
                (x) => x.assigneeId === id,
              );
              const statusKey =
                f?.status === "SIGNED"
                  ? "signing.statusSigned"
                  : f?.status === "REJECTED"
                    ? "signing.statusRejected"
                    : "signing.statusPending";
              return (
                <li
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-secondary/60 px-2 py-0.5 text-[11px]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colorFor(id) }}
                  />
                  <span className="font-medium text-foreground">
                    {resolveName(id)}
                    {id === currentUserId && (
                      <span className="ml-1 text-primary">
                        ({t("common.you")})
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    · {t(statusKey)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}


"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileSignature, Trash2, Upload } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { PdfCanvas, type FieldRect, type OverlayField } from "../lib/pdf-canvas";
import { convertDocxToPdf, isDocx } from "../lib/docx-to-pdf";
import type { SigningDraft } from "../types/signature";

// Distinct colors so each approver's boxes are visually separable.
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

const colorFor = (approverIds: string[], id: string) =>
  PALETTE[Math.max(0, approverIds.indexOf(id)) % PALETTE.length];

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export type SignaturePlacementSectionProps = {
  /** Ordered approver user ids drawn from the flow (signing assignees). */
  approverIds: string[];
  resolveName: (id: string) => string;
  draft: SigningDraft;
  onChange: (draft: SigningDraft) => void;
};

export function SignaturePlacementSection({
  approverIds,
  resolveName,
  draft,
  onChange,
}: SignaturePlacementSectionProps) {
  const t = useT();
  const { notify } = useNotifications();
  const fileRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [activeApprover, setActiveApprover] = useState<string | null>(null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  // Keep the active approver valid as the flow changes.
  useEffect(() => {
    if (approverIds.length === 0) {
      if (activeApprover !== null) setActiveApprover(null);
    } else if (!activeApprover || !approverIds.includes(activeApprover)) {
      setActiveApprover(approverIds[0]);
    }
  }, [approverIds, activeApprover]);

  // Drop boxes whose approver was removed from the flow (positions track the
  // current approver set; everyone remaining must still be positioned).
  useEffect(() => {
    const pruned = draft.fields.filter((f) => approverIds.includes(f.assigneeId));
    if (pruned.length !== draft.fields.length) {
      onChange({ ...draft, fields: pruned });
    }
  }, [approverIds, draft, onChange]);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setConverting(true);
    try {
      const pdf = isDocx(picked) ? await convertDocxToPdf(picked) : picked;
      const bytes = await pdf.arrayBuffer();
      // Changing the document resets all placements "from scratch".
      onChange({
        ...draft,
        file: pdf,
        bytes,
        fileName: pdf.name,
        fields: [],
        existingDocumentId: null,
      });
      setPage(1);
      setActiveFieldId(null);
    } catch {
      notify({ title: t("signing.saveFailed"), kind: "error" });
    } finally {
      setConverting(false);
    }
  }

  function removeDoc() {
    onChange({
      file: null,
      bytes: null,
      fileName: null,
      fields: [],
      existingDocumentId: null,
    });
    setPage(1);
    setActiveFieldId(null);
  }

  const setFields = (fields: OverlayField[]) => onChange({ ...draft, fields });

  function placeField(rect: FieldRect) {
    if (!activeApprover) return;
    const id = uid();
    setFields([
      ...draft.fields,
      {
        id,
        assigneeId: activeApprover,
        page,
        ...rect,
        color: colorFor(approverIds, activeApprover),
        label: resolveName(activeApprover),
      },
    ]);
    setActiveFieldId(id);
  }

  const countFor = (id: string) =>
    draft.fields.filter((f) => f.assigneeId === id).length;
  const allPositioned =
    approverIds.length > 0 && approverIds.every((id) => countFor(id) > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileSignature size={15} className="text-muted-foreground" />
        {t("signing.section")}
      </div>

      {!draft.bytes ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("signing.mustHaveDoc")}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf"
            onChange={handlePick}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={converting}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} />
            {t("signing.selectDoc")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Document toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">
              {draft.fileName}
            </span>
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,application/pdf"
                onChange={handlePick}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={converting}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={14} />
                {t("signing.changeDoc")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeDoc}
              >
                <Trash2 size={14} />
                {t("signing.removeDoc")}
              </Button>
            </div>
          </div>

          {/* Approver palette: pick whose box you place next */}
          {approverIds.length === 0 ? (
            <p className="text-xs text-amber-600">
              {t("signing.selectApproverFirst")}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {approverIds.map((id) => {
                const selected = activeApprover === id;
                const color = colorFor(approverIds, id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveApprover(id)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      borderColor: color,
                      backgroundColor: selected ? `${color}22` : "transparent",
                      color,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {resolveName(id)}
                    <span className="opacity-70">({countFor(id)})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Page navigation */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
                {t("signing.prev")}
              </Button>
              <span>{t("signing.pageOf", { page, total: pageCount })}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                {t("signing.next")}
                <ChevronRight size={14} />
              </Button>
            </div>
          )}

          {/* Preview + placement */}
          <PdfCanvas
            data={draft.bytes}
            page={page}
            onPageCount={setPageCount}
            fields={draft.fields}
            editable
            placeColor={
              activeApprover
                ? colorFor(approverIds, activeApprover)
                : "#6366f1"
            }
            onPlace={activeApprover ? placeField : undefined}
            activeFieldId={activeFieldId}
            onFieldSelect={setActiveFieldId}
            onFieldMove={(id, c) =>
              setFields(
                draft.fields.map((f) => (f.id === id ? { ...f, ...c } : f)),
              )
            }
            onFieldResize={(id, c) =>
              setFields(
                draft.fields.map((f) => (f.id === id ? { ...f, ...c } : f)),
              )
            }
            onFieldRemove={(id) =>
              setFields(draft.fields.filter((f) => f.id !== id))
            }
          />

          <p
            className={`text-xs font-medium ${
              allPositioned ? "text-green-600" : "text-amber-600"
            }`}
          >
            {allPositioned
              ? t("signing.allPositioned")
              : t("signing.missingPositions")}
          </p>
        </div>
      )}
    </div>
  );
}

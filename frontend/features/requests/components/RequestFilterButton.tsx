"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import type { FormSummary } from "@/features/forms/types/form";
import type { DateRange } from "../hooks/useRequestList";

export type RequestFilterButtonProps = {
  formId: string | null;
  dateRange: DateRange;
  forms: FormSummary[];
  /** Expose a form selector inside the popover when no external selector is shown. */
  showFormSelector?: boolean;
  onApply: (next: { formId: string | null; dateRange: DateRange }) => void;
};

const EMPTY_RANGE: DateRange = { from: null, to: null };

/**
 * Compact date-range (and optional form) filter popover. Drafts are synced
 * directly on open so stale state never flashes.
 */
export function RequestFilterButton({
  formId,
  dateRange,
  forms,
  showFormSelector = false,
  onApply,
}: RequestFilterButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draftFormId, setDraftFormId] = useState<string | null>(formId);
  const [draftRange, setDraftRange] = useState<DateRange>(dateRange);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggleOpen = () => {
    if (!open) {
      setDraftFormId(formId);
      setDraftRange(dateRange);
    }
    setOpen((v) => !v);
  };

  const activeCount =
    (showFormSelector && formId ? 1 : 0) +
    (dateRange.from || dateRange.to ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="md" onClick={toggleOpen}>
        <Calendar size={14} className="text-muted-foreground" />
        {t("requests.createdAt")}
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 space-y-4 rounded-lg border border-border bg-popover p-4 shadow-lg">
          {showFormSelector && (
            <Field label={t("requests.formTypes")}>
              <Select
                value={draftFormId ?? ""}
                onChange={(e) => setDraftFormId(e.target.value || null)}
              >
                <option value="">{t("requests.allForms")}</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label={t("requests.createdAt")}>
            <div className="flex flex-col gap-2">
              <Input
                type="date"
                value={draftRange.from ?? ""}
                max={draftRange.to ?? undefined}
                onChange={(e) =>
                  setDraftRange((r) => ({ ...r, from: e.target.value || null }))
                }
              />
              <Input
                type="date"
                value={draftRange.to ?? ""}
                min={draftRange.from ?? undefined}
                onChange={(e) =>
                  setDraftRange((r) => ({ ...r, to: e.target.value || null }))
                }
              />
            </div>
          </Field>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftFormId(null);
                setDraftRange(EMPTY_RANGE);
                onApply({
                  formId: showFormSelector ? null : formId,
                  dateRange: EMPTY_RANGE,
                });
                setOpen(false);
              }}
            >
              {t("common.clear")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApply({
                  formId: showFormSelector ? draftFormId : formId,
                  dateRange: draftRange,
                });
                setOpen(false);
              }}
            >
              {t("common.apply")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

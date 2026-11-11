"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
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
  /** True when the left panel has "All" selected — then expose a form selector. */
  showFormSelector: boolean;
  onApply: (next: { formId: string | null; dateRange: DateRange }) => void;
};

const EMPTY_RANGE: DateRange = { from: null, to: null };

/**
 * Dynamic filter popover. Offers a created-at range; when "All forms" is active
 * it also offers a form-type selector (spec: All → include form-type filter).
 * The status filter lives in the toolbar. Edits are staged, committed on Apply.
 */
export function RequestFilterButton({
  formId,
  dateRange,
  forms,
  showFormSelector,
  onApply
}: RequestFilterButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draftFormId, setDraftFormId] = useState<string | null>(formId);
  const [draftRange, setDraftRange] = useState<DateRange>(dateRange);
  const ref = useRef<HTMLDivElement>(null);

  // Re-sync drafts to the live filters whenever the popover opens.
  useEffect(() => {
    if (open) {
      setDraftFormId(formId);
      setDraftRange(dateRange);
    }
  }, [open, formId, dateRange]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const activeCount =
    (formId ? 1 : 0) + (dateRange.from || dateRange.to ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="md" onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal size={15} />
        {t("requests.filter")}
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 space-y-4 rounded-lg border border-border bg-popover p-4 shadow-lg">
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
            <div className="flex-col items-center gap-2">
              <Input
                type="date"
                value={draftRange.from ?? ""}
                max={draftRange.to ?? undefined}
                onChange={(e) =>
                  setDraftRange((r) => ({ ...r, from: e.target.value || null }))
                }
              />
              <span className="text-muted-foreground">–</span>
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
                onApply({ formId: null, dateRange: EMPTY_RANGE });
                setOpen(false);
              }}
            >
              {t("common.clear")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApply({ formId: draftFormId, dateRange: draftRange });
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

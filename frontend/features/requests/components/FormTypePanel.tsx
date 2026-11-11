"use client";

import { Layers, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import type { FormSummary } from "@/features/forms/types/form";
import { cn } from "@/lib/utils/cn";

function FormTypeItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 truncate rounded-md px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

export type FormTypePanelProps = {
  forms: FormSummary[];
  loading: boolean;
  /** Currently selected form id, or null for "All". */
  selected: string | null;
  onSelect: (formId: string | null) => void;
  /** Collapsed = show a thin rail with just an expand button. */
  collapsed: boolean;
  onToggleCollapse: () => void;
};

/** Left rail listing form categories; selecting one filters the request list. */
export function FormTypePanel({
  forms,
  loading,
  selected,
  onSelect,
  collapsed,
  onToggleCollapse,
}: FormTypePanelProps) {
  const t = useT();

  if (collapsed) {
    return (
      <aside className="shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          title={t("requests.expandPanel")}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelLeftOpen size={15} />
          <Layers size={13} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-56 shrink-0">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Layers size={13} />
          {t("requests.formTypes")}
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          title={t("requests.collapsePanel")}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="space-y-0.5">
        <FormTypeItem
          label={t("requests.allForms")}
          active={selected === null}
          onClick={() => onSelect(null)}
        />
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="mx-1 my-1.5 h-4 animate-pulse rounded bg-muted"
              />
            ))
          : forms.map((form) => (
              <FormTypeItem
                key={form.id}
                label={form.name}
                active={selected === form.id}
                onClick={() => onSelect(form.id)}
              />
            ))}
      </div>
    </aside>
  );
}

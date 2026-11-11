"use client";

import { FileText, ChevronRight } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFormCategories } from "@/features/forms/hooks/useFormCategories";
import { formatDate } from "@/lib/utils/format";

export function SelectFormStep({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (formId: string) => void;
}) {
  const t = useT();
  const [locale] = useLocale();
  const { forms, loading } = useFormCategories();

  if (loading) return <LoadingState />;
  if (forms.length === 0) return <EmptyState title={t("create.noForms")} />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("create.selectFormDesc")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => {
          const active = form.id === selectedId;
          return (
            <button
              key={form.id}
              type="button"
              onClick={() => onSelect(form.id)}
              className={`group flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <FileText size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {form.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  v{form.latestVersion} · {formatDate(form.createdAt, locale)}
                </span>
              </span>
              <ChevronRight
                size={16}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Type, Hash, Calendar, List, Plus } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { FIELD_TYPES } from "../../types/builder";
import type { FieldType } from "../../types/form";

const icons: Record<FieldType, React.ReactNode> = {
  TEXT: <Type size={16} />,
  NUMBER: <Hash size={16} />,
  DATE: <Calendar size={16} />,
  SELECT: <List size={16} />,
};

/** Left column: click a field type to append it to the form. */
export function FieldTypePalette({
  onAdd,
}: {
  onAdd: (type: FieldType) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("formBuilder.fieldTypes")}
      </p>
      <div className="space-y-1.5">
        {FIELD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(type)}
            className="group flex w-full items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
          >
            <span className="text-muted-foreground group-hover:text-primary">
              {icons[type]}
            </span>
            <span className="flex-1 text-left">{t(`fieldType.${type}`)}</span>
            <Plus size={14} className="text-muted-foreground" />
          </button>
        ))}
      </div>
      <p className="px-1 pt-1 text-xs text-muted-foreground">
        {t("formBuilder.addFieldHint")}
      </p>
    </div>
  );
}

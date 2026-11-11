"use client";

import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FieldDraft } from "../../types/builder";
import { cn } from "@/lib/utils/cn";

export type FieldListProps = {
  fields: FieldDraft[];
  selectedUid: string | null;
  onSelect: (uid: string) => void;
  onReorder: (from: number, to: number) => void;
  onDelete: (uid: string) => void;
};

/** Middle column: ordered, drag-to-reorder list of the form's fields. */
export function FieldList({
  fields,
  selectedUid,
  onSelect,
  onReorder,
  onDelete,
}: FieldListProps) {
  const t = useT();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (fields.length === 0) {
    return <EmptyState title={t("formBuilder.noFields")} />;
  }

  return (
    <ul className="space-y-1.5">
      {fields.map((field, i) => {
        const selected = field.uid === selectedUid;
        const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
        return (
          <li
            key={field.uid}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(i);
            }}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onClick={() => onSelect(field.uid)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 transition-colors",
              selected
                ? "border-primary bg-accent"
                : "border-border bg-card hover:bg-muted",
              isOver && "border-primary/60",
            )}
          >
            <GripVertical
              size={15}
              className="shrink-0 cursor-grab text-muted-foreground"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {field.label.trim() || field.key || t("formBuilder.untitled")}
                {field.required && (
                  <span className="ml-0.5 text-destructive">*</span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t(`fieldType.${field.type}`)}
                {field.key ? ` · ${field.key}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(field.uid);
              }}
              title={t("formBuilder.deleteField")}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 size={15} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useState } from "react";
import { useT } from "@/components/providers/I18nProvider";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";
import type {
  LayoutItem,
  LayoutSection,
} from "../../types/form";
import {
  COL_SPAN_OPTIONS,
  type BuilderSelection,
  type FieldDraft,
} from "../../types/builder";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { VisibilityRuleEditor } from "./VisibilityRuleEditor";

export function LayoutInspectorPanel({
  selection,
  sections,
  fields,
  onUpdateSection,
  onUpdateItem,
  onUpdateField,
  onRenameFieldKey,
}: {
  selection: BuilderSelection;
  sections: LayoutSection[];
  fields: FieldDraft[];
  onUpdateSection: (sectionId: string, patch: Partial<LayoutSection>) => void;
  onUpdateItem: (
    sectionId: string,
    rowId: string,
    itemId: string,
    patch: Partial<LayoutItem>,
  ) => void;
  onUpdateField: (uid: string, patch: Partial<FieldDraft>) => void;
  onRenameFieldKey: (uid: string, oldKey: string, newKey: string) => void;
}) {
  const t = useT();
  const [fieldTab, setFieldTab] = useState<"data" | "layout">("data");

  if (!selection) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        {t("formBuilder.selectFieldHint")}
      </p>
    );
  }

  if (selection.kind === "section") {
    const sec = sections.find((s) => s.id === selection.sectionId);
    if (!sec) return null;

    return (
      <div className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("formBuilder.sectionTitle")}
        </p>

        <Field label={t("formBuilder.sectionTitle")}>
          <Input
            value={sec.title}
            onChange={(e) => onUpdateSection(sec.id, { title: e.target.value })}
          />
        </Field>

        <Field label={t("formBuilder.sectionDesc")}>
          <Input
            value={sec.description ?? ""}
            onChange={(e) =>
              onUpdateSection(sec.id, {
                description: e.target.value || undefined,
              })
            }
          />
        </Field>

        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={Boolean(sec.collapsible)}
            onChange={(e) =>
              onUpdateSection(sec.id, { collapsible: e.target.checked })
            }
            className="h-4 w-4 accent-primary"
          />
          {t("formBuilder.sectionCollapsible")}
        </label>

        <VisibilityRuleEditor
          value={sec.visibleWhen}
          onChange={(visibleWhen) => onUpdateSection(sec.id, { visibleWhen })}
          fields={fields}
          sections={sections}
        />
      </div>
    );
  }

  const sec = sections.find((s) => s.id === selection.sectionId);
  const row = sec?.rows.find((r) => r.id === selection.rowId);
  const item = row?.items.find((i) => i.id === selection.itemId);
  if (!sec || !row || !item) return null;

  const rowRemaining =
    12 - row.items.reduce((sum, x) => sum + x.colSpan, 0) + item.colSpan;

  const colSpanPicker = (
    <Field label={t("formBuilder.colSpan")}>
      <div className="flex flex-wrap gap-1.5">
        {COL_SPAN_OPTIONS.map((span) => (
          <button
            key={span}
            type="button"
            disabled={span > rowRemaining}
            onClick={() =>
              onUpdateItem(sec.id, row.id, item.id, { colSpan: span })
            }
            className={cn(
              "rounded border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
              item.colSpan === span
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground hover:bg-surface-secondary disabled:opacity-35",
            )}
          >
            {span}/12
          </button>
        ))}
      </div>
    </Field>
  );

  if (item.kind === "heading") {
    return (
      <div className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("formBuilder.headingBlock")}
        </p>
        <Field label={t("formBuilder.label")}>
          <Input
            value={item.text}
            onChange={(e) =>
              onUpdateItem(sec.id, row.id, item.id, { text: e.target.value })
            }
          />
        </Field>
        <Field label={t("formBuilder.sectionDesc")}>
          <Input
            value={item.subtitle ?? ""}
            onChange={(e) =>
              onUpdateItem(sec.id, row.id, item.id, {
                subtitle: e.target.value || undefined,
              })
            }
          />
        </Field>
        {colSpanPicker}
        <VisibilityRuleEditor
          value={item.visibleWhen}
          onChange={(visibleWhen) =>
            onUpdateItem(sec.id, row.id, item.id, { visibleWhen })
          }
          fields={fields}
          sections={sections}
        />
      </div>
    );
  }

  if (item.kind === "divider") {
    return (
      <div className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("formBuilder.dividerBlock")}
        </p>
        {colSpanPicker}
        <VisibilityRuleEditor
          value={item.visibleWhen}
          onChange={(visibleWhen) =>
            onUpdateItem(sec.id, row.id, item.id, { visibleWhen })
          }
          fields={fields}
          sections={sections}
        />
      </div>
    );
  }

  if (item.kind === "attachmentSlot") {
    return (
      <div className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("formBuilder.attachmentSlotBlock")}
        </p>
        <Field label={t("formBuilder.label")}>
          <Input
            value={item.label}
            onChange={(e) =>
              onUpdateItem(sec.id, row.id, item.id, { label: e.target.value })
            }
          />
        </Field>
        <Field label={t("formBuilder.slotKey")}>
          <Input
            value={item.slotKey}
            onChange={(e) =>
              onUpdateItem(sec.id, row.id, item.id, {
                slotKey: e.target.value.replace(/\s+/g, "_"),
              })
            }
          />
        </Field>
        <Field label={t("formBuilder.slotSection")}>
          <Select
            value={item.targetSection}
            onChange={(e) =>
              onUpdateItem(sec.id, row.id, item.id, {
                targetSection: e.target.value as "MAIN" | "SECONDARY",
              })
            }
          >
            <option value="MAIN">{t("formBuilder.slotMain")}</option>
            <option value="SECONDARY">{t("formBuilder.slotSecondary")}</option>
          </Select>
        </Field>
        <Field label={t("formBuilder.sectionDesc")}>
          <Input
            value={item.description ?? ""}
            onChange={(e) =>
              onUpdateItem(sec.id, row.id, item.id, {
                description: e.target.value || undefined,
              })
            }
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={Boolean(item.required)}
            onChange={(e) =>
              onUpdateItem(sec.id, row.id, item.id, {
                required: e.target.checked,
              })
            }
            className="h-4 w-4 accent-primary"
          />
          {t("formBuilder.required")}
        </label>
        {colSpanPicker}
        <VisibilityRuleEditor
          value={item.visibleWhen}
          onChange={(visibleWhen) =>
            onUpdateItem(sec.id, row.id, item.id, { visibleWhen })
          }
          fields={fields}
          sections={sections}
        />
      </div>
    );
  }

  // item.kind === "field"
  const fieldDraft = fields.find((f) => f.key === item.fieldKey) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-md bg-surface-secondary p-1 text-xs">
        <button
          type="button"
          onClick={() => setFieldTab("data")}
          className={cn(
            "rounded px-2 py-1.5 font-medium transition-colors",
            fieldTab === "data"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("formBuilder.tabData")}
        </button>
        <button
          type="button"
          onClick={() => setFieldTab("layout")}
          className={cn(
            "rounded px-2 py-1.5 font-medium transition-colors",
            fieldTab === "layout"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("formBuilder.tabLayout")}
        </button>
      </div>

      {fieldTab === "data" ? (
        <FieldConfigPanel
          field={fieldDraft}
          allFields={fields}
          onChange={onUpdateField}
          onRenameKey={onRenameFieldKey}
        />
      ) : (
        <div className="space-y-4">
          {colSpanPicker}

          <Field label={t("formBuilder.helpText")}>
            <Input
              value={item.helpText ?? ""}
              onChange={(e) =>
                onUpdateItem(sec.id, row.id, item.id, {
                  helpText: e.target.value || undefined,
                })
              }
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={Boolean(item.readOnly)}
              onChange={(e) =>
                onUpdateItem(sec.id, row.id, item.id, {
                  readOnly: e.target.checked,
                })
              }
              className="h-4 w-4 accent-primary"
            />
            {t("formBuilder.readOnly")}
          </label>

          <VisibilityRuleEditor
            value={item.visibleWhen}
            onChange={(visibleWhen) =>
              onUpdateItem(sec.id, row.id, item.id, { visibleWhen })
            }
            fields={fields}
            sections={sections}
            currentFieldKey={item.fieldKey}
          />
        </div>
      )}
    </div>
  );
}


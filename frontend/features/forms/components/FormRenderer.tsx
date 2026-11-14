"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import type {
  FormDetail,
  FormValues,
  LayoutAttachmentSlotItem,
  LayoutItem,
  LayoutSection,
  RequestValue,
} from "../types/form";
import {
  applyTableAggregates,
  evaluateVisibility,
  normalizeLayoutSchema,
  getAggregateTargetFieldKeys,
} from "../lib/layout";
import {
  buildInitialValues,
  filterVisibleValues,
  toRequestValues,
} from "../lib/values";
import {
  validateFormWithDetails,
  type TableCellErrors,
} from "../lib/validation";
import { FormFieldRenderer } from "./FormFieldRenderer";

const COL_SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};

export function colSpanClass(colSpan: number): string {
  const clamped = Math.min(12, Math.max(1, Math.round(colSpan)));
  return COL_SPAN_CLASS[clamped] ?? "md:col-span-12";
}

export type FormRendererProps = {
  /** Form definition from GET /forms/:id or GET /forms/versions/:versionId. */
  form: FormDetail;
  /** Pre-fill values (keyed by field key). */
  initialValues?: FormValues;
  /** Live counts from document step to show guidance status on attachmentSlots. */
  attachmentCounts?: { MAIN?: number; SECONDARY?: number };
  onSubmit: (
    values: RequestValue[],
    raw: FormValues,
  ) => void | Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
  onChange?: (values: FormValues) => void;
};

/**
 * Layout-aware runtime form engine. Renders normalized LayoutSchemaV1 sections,
 * 12-col responsive rows, TABLE repeaters, attachment hints, and conditional
 * visibility rules, emitting clean EAV values on submit.
 */
export function FormRenderer({
  form,
  initialValues,
  attachmentCounts,
  onSubmit,
  submitLabel = "Submit",
  disabled,
  onChange,
}: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(() =>
    buildInitialValues(form, initialValues),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tableErrors, setTableErrors] = useState<
    Record<string, TableCellErrors>
  >({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues((prev) => {
      const defaults = buildInitialValues(form, initialValues);
      return { ...defaults, ...prev };
    });
  }, [form.fields, initialValues]);

  const normalizedLayout = useMemo(
    () => normalizeLayoutSchema(form.name, form.fields, form.layoutSchema),
    [form.name, form.fields, form.layoutSchema],
  );

  const fieldByKey = useMemo(
    () => new Map(form.fields.map((f) => [f.key, f])),
    [form.fields],
  );

  const autoTargetKeys = useMemo(
    () => getAggregateTargetFieldKeys(form.fields),
    [form.fields],
  );

  const setValue = (key: string, value: unknown) => {
    setValues((prev) => {
      const next = applyTableAggregates(form.fields, { ...prev, [key]: value });
      onChange?.(next);
      return next;
    });
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTableErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const {
      errors: nextErrors,
      tableErrors: nextTableErrors,
      visibleKeys,
    } = validateFormWithDetails(form.fields, values, normalizedLayout);

    setErrors(nextErrors);
    setTableErrors(nextTableErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const cleanRaw = filterVisibleValues(values, visibleKeys);
    const eavPayload = toRequestValues(cleanRaw, visibleKeys);

    try {
      setSubmitting(true);
      await onSubmit(eavPayload, cleanRaw);
    } finally {
      setSubmitting(false);
    }
  };

  const busy = disabled || submitting;
  const showNumbers = normalizedLayout.settings?.showSectionNumbers !== false;
  const visibleSections = normalizedLayout.sections.filter((sec) =>
    evaluateVisibility(sec.visibleWhen, values),
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {visibleSections.map((sec, sIdx) => (
        <SectionCard
          key={sec.id}
          section={sec}
          sectionNumber={showNumbers ? sIdx + 1 : undefined}
          values={values}
          fieldByKey={fieldByKey}
          autoTargetKeys={autoTargetKeys}
          errors={errors}
          tableErrors={tableErrors}
          attachmentCounts={attachmentCounts}
          busy={busy}
          onChange={setValue}
        />
      ))}

      <Button type="submit" loading={submitting} disabled={busy}>
        {submitting ? "…" : submitLabel}
      </Button>
    </form>
  );
}

function SectionCard({
  section,
  sectionNumber,
  values,
  fieldByKey,
  autoTargetKeys,
  errors,
  tableErrors,
  attachmentCounts,
  busy,
  onChange,
}: {
  section: LayoutSection;
  sectionNumber?: number;
  values: FormValues;
  fieldByKey: Map<string, FormDetail["fields"][number]>;
  autoTargetKeys: Set<string>;
  errors: Record<string, string>;
  tableErrors: Record<string, TableCellErrors>;
  attachmentCounts?: { MAIN?: number; SECONDARY?: number };
  busy: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  const [collapsed, setCollapsed] = useState(Boolean(section.defaultCollapsed));

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {sectionNumber !== undefined
                ? `${sectionNumber}. ${section.title}`
                : section.title}
            </h3>
            {section.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {section.description}
              </p>
            )}
          </div>
          {section.collapsible && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="space-y-4">
            {section.rows.map((row) => {
              const visibleItems = row.items.filter((item) =>
                evaluateVisibility(item.visibleWhen, values),
              );
              if (visibleItems.length === 0) return null;

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-4 md:grid-cols-12"
                >
                  {visibleItems.map((item) => (
                    <div key={item.id} className={colSpanClass(item.colSpan)}>
                      <RenderLayoutItem
                        item={item}
                        values={values}
                        fieldByKey={fieldByKey}
                        autoTargetKeys={autoTargetKeys}
                        errors={errors}
                        tableErrors={tableErrors}
                        attachmentCounts={attachmentCounts}
                        busy={busy}
                        onChange={onChange}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RenderLayoutItem({
  item,
  values,
  fieldByKey,
  autoTargetKeys,
  errors,
  tableErrors,
  attachmentCounts,
  busy,
  onChange,
}: {
  item: LayoutItem;
  values: FormValues;
  fieldByKey: Map<string, FormDetail["fields"][number]>;
  autoTargetKeys: Set<string>;
  errors: Record<string, string>;
  tableErrors: Record<string, TableCellErrors>;
  attachmentCounts?: { MAIN?: number; SECONDARY?: number };
  busy: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  if (item.kind === "heading") {
    return (
      <div className="pt-1">
        <p className="text-sm font-semibold text-foreground">{item.text}</p>
        {item.subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
        )}
      </div>
    );
  }

  if (item.kind === "divider") {
    return <hr className="my-1 border-border-subtle" />;
  }

  if (item.kind === "attachmentSlot") {
    return (
      <AttachmentSlotNotice
        slot={item}
        attachedCount={attachmentCounts?.[item.targetSection]}
      />
    );
  }

  const field = fieldByKey.get(item.fieldKey);
  if (!field) return null;

  const isAuto = autoTargetKeys.has(field.key);
  return (
    <FormFieldRenderer
      field={field}
      value={values[field.key]}
      error={errors[field.key]}
      cellErrors={tableErrors[field.key]}
      disabled={busy}
      readOnly={item.readOnly}
      helpText={item.helpText}
      autoComputed={isAuto}
      onChange={(v) => onChange(field.key, v)}
    />
  );
}

function AttachmentSlotNotice({
  slot,
  attachedCount,
}: {
  slot: LayoutAttachmentSlotItem;
  attachedCount?: number;
}) {
  const t = useT();
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/50 px-3 py-2.5">
      <Paperclip size={15} className="mt-0.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {slot.label}
          </span>
          <Badge tone={slot.targetSection === "MAIN" ? "info" : "neutral"}>
            {slot.targetSection === "MAIN"
              ? t("formBuilder.slotMain")
              : t("formBuilder.slotSecondary")}
          </Badge>
          {slot.required && <Badge tone="warning">{t("formBuilder.required")}</Badge>}
        </div>
        {slot.description && (
          <p className="text-xs text-muted-foreground">{slot.description}</p>
        )}
        {attachedCount !== undefined && (
          <p className="text-[11px] font-medium text-muted-foreground">
            {attachedCount > 0
              ? t("formRenderer.attachedCount", { count: attachedCount })
              : t("formRenderer.notAttachedYet")}
          </p>
        )}
      </div>
    </div>
  );
}

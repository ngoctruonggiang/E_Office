"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "@/lib/utils/format";
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
  /** Currently staged files for MAIN attachment section. */
  mainFiles?: File[];
  /** Currently staged files for SECONDARY attachment section. */
  secondaryFiles?: File[];
  /** Callback when user adds files via an attachmentSlot. */
  onAddFiles?: (section: "MAIN" | "SECONDARY", files: File[]) => void;
  /** Callback when user removes a file via an attachmentSlot. */
  onRemoveFile?: (section: "MAIN" | "SECONDARY", index: number) => void;
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
 * 12-col responsive rows, TABLE repeaters, interactive attachment upload slots,
 * and conditional visibility rules, emitting clean EAV values on submit.
 */
export function FormRenderer({
  form,
  initialValues,
  attachmentCounts,
  mainFiles,
  secondaryFiles,
  onAddFiles,
  onRemoveFile,
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
          mainFiles={mainFiles}
          secondaryFiles={secondaryFiles}
          onAddFiles={onAddFiles}
          onRemoveFile={onRemoveFile}
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
  mainFiles,
  secondaryFiles,
  onAddFiles,
  onRemoveFile,
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
  mainFiles?: File[];
  secondaryFiles?: File[];
  onAddFiles?: (section: "MAIN" | "SECONDARY", files: File[]) => void;
  onRemoveFile?: (section: "MAIN" | "SECONDARY", index: number) => void;
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
                        mainFiles={mainFiles}
                        secondaryFiles={secondaryFiles}
                        onAddFiles={onAddFiles}
                        onRemoveFile={onRemoveFile}
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
  mainFiles,
  secondaryFiles,
  onAddFiles,
  onRemoveFile,
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
  mainFiles?: File[];
  secondaryFiles?: File[];
  onAddFiles?: (section: "MAIN" | "SECONDARY", files: File[]) => void;
  onRemoveFile?: (section: "MAIN" | "SECONDARY", index: number) => void;
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
    const slotFiles =
      item.targetSection === "MAIN" ? (mainFiles ?? []) : (secondaryFiles ?? []);
    return (
      <AttachmentSlotUploader
        slot={item}
        files={slotFiles}
        attachedCount={attachmentCounts?.[item.targetSection]}
        onAddFiles={onAddFiles}
        onRemoveFile={onRemoveFile}
        disabled={busy}
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

function AttachmentSlotUploader({
  slot,
  files = [],
  attachedCount,
  onAddFiles,
  onRemoveFile,
  disabled,
}: {
  slot: LayoutAttachmentSlotItem;
  files?: File[];
  attachedCount?: number;
  onAddFiles?: (section: "MAIN" | "SECONDARY", files: File[]) => void;
  onRemoveFile?: (section: "MAIN" | "SECONDARY", index: number) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0 || !onAddFiles) return;
    const list = Array.from(incoming);
    onAddFiles(slot.targetSection, list);
  };

  const isInteractive = Boolean(onAddFiles);
  const totalCount = files.length > 0 ? files.length : (attachedCount ?? 0);

  return (
    <div
      onDragOver={(e) => {
        if (!isInteractive || disabled) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        if (!isInteractive || disabled) return;
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border border-dashed transition-all p-3.5 space-y-2.5",
        isDragging
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-surface-secondary/40 hover:border-foreground/30",
      )}
    >
      {/* Hidden file input */}
      {isInteractive && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={disabled}
          accept={slot.acceptMimeTypes?.join(",")}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      )}

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip size={15} className="shrink-0 text-primary" />
          <span className="text-xs font-semibold text-foreground truncate">
            {slot.label}
          </span>
          <Badge tone={slot.targetSection === "MAIN" ? "info" : "neutral"}>
            {slot.targetSection === "MAIN"
              ? t("formBuilder.slotMain")
              : t("formBuilder.slotSecondary")}
          </Badge>
          {slot.required && (
            <Badge tone="warning">{t("formBuilder.required")}</Badge>
          )}
        </div>

        {isInteractive && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 font-medium text-xs gap-1.5"
          >
            <Upload size={12} />
            + Chọn tệp tải lên
          </Button>
        )}
      </div>

      {slot.description && (
        <p className="text-xs text-muted-foreground">{slot.description}</p>
      )}

      {/* Files list or interactive drop prompt */}
      {files.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <ul className="space-y-1.5">
            {files.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-1.5 shadow-2xs text-xs"
              >
                <FileText size={15} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                {onRemoveFile && !disabled && (
                  <button
                    type="button"
                    onClick={() => onRemoveFile(slot.targetSection, idx)}
                    title={t("create.removeFile") || "Xóa tệp"}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-danger-subtle hover:text-danger transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground pt-0.5">
            ✓ Đã đính kèm {files.length} tệp vào nhóm{" "}
            <strong>
              {slot.targetSection === "MAIN" ? "Tài liệu chính" : "Tài liệu phụ"}
            </strong>
            . Bạn có thể thêm tệp khác hoặc chỉnh sửa tại Bước 3 (Tài liệu & Ký số).
          </p>
        </div>
      ) : isInteractive ? (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-subtle bg-surface/70 py-3 text-center transition-colors hover:bg-surface hover:border-primary/40"
        >
          <p className="text-xs font-medium text-foreground">
            Bấm vào đây hoặc kéo thả tài liệu để đính kèm
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Hỗ trợ PDF, DOCX, XLSX, hình ảnh (tối đa 25MB)
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border-subtle bg-surface/50 p-2.5 text-[11px] text-muted-foreground">
          {totalCount > 0
            ? t("formRenderer.attachedCount", { count: totalCount })
            : "Vị trí đính kèm tài liệu: Người làm đơn có thể chọn tải tệp trực tiếp tại đây hoặc ở Bước 3 (Tài liệu & Ký số)."}
        </div>
      )}
    </div>
  );
}

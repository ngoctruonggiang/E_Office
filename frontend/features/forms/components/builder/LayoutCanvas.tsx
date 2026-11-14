"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  Lock,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type {
  FormDetail,
  LayoutItem,
  LayoutSection,
} from "../../types/form";
import {
  COL_SPAN_OPTIONS,
  draftToFieldView,
  type BuilderSelection,
  type FieldDraft,
} from "../../types/builder";
import { colSpanClass, FormRenderer } from "../FormRenderer";

export function LayoutCanvas({
  mode,
  formName,
  fields,
  sections,
  selection,
  onSelect,
  onMoveSection,
  onDeleteSection,
  onAddRow,
  onMoveItem,
  onSetItemColSpan,
  onDeleteItem,
}: {
  mode: "design" | "preview";
  formName: string;
  fields: FieldDraft[];
  sections: LayoutSection[];
  selection: BuilderSelection;
  onSelect: (sel: BuilderSelection) => void;
  onMoveSection: (sectionIdx: number, delta: -1 | 1) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddRow: (sectionId: string) => void;
  onMoveItem: (
    sectionId: string,
    rowId: string,
    itemId: string,
    dir: "left" | "right" | "up" | "down",
  ) => void;
  onSetItemColSpan: (
    sectionId: string,
    rowId: string,
    itemId: string,
    colSpan: number,
  ) => void;
  onDeleteItem: (sectionId: string, rowId: string, itemId: string) => void;
}) {
  const t = useT();

  if (mode === "preview") {
    if (fields.length === 0) {
      return <EmptyState title={t("formBuilder.noFields")} />;
    }
    const previewForm: FormDetail = {
      id: "preview",
      name: formName.trim() || t("formBuilder.untitled"),
      version: 1,
      versionId: "preview-v1",
      fields: fields.map(draftToFieldView),
      layoutSchema: {
        schemaVersion: 1,
        settings: { columns: 12, labelPlacement: "top", showSectionNumbers: true },
        sections: sections.map((sec) => ({
          ...sec,
          rows: sec.rows.filter((r) => r.items.length > 0),
        })),
      },
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-info-border bg-info-subtle px-3 py-2 text-xs text-info">
          <Eye size={14} className="shrink-0" />
          <span>{t("formBuilder.previewTab")}</span>
        </div>
        <FormRenderer
          key={JSON.stringify(previewForm)}
          form={previewForm}
          submitLabel={t("common.submit")}
          onSubmit={() => {
            /* interactive preview only */
          }}
        />
      </div>
    );
  }

  if (sections.length === 0) {
    return <EmptyState title={t("formBuilder.noFields")} />;
  }

  const fieldByKey = new Map(fields.map((f) => [f.key, f]));

  return (
    <div className="space-y-4">
      {sections.map((sec, sIdx) => {
        const isSectionSelected =
          selection?.kind === "section" && selection.sectionId === sec.id;

        return (
          <Card
            key={sec.id}
            className={cn(
              "transition-colors",
              isSectionSelected && "border-primary ring-1 ring-primary/30",
            )}
          >
            <CardBody className="space-y-3">
              {/* Section header */}
              <div
                onClick={() => onSelect({ kind: "section", sectionId: sec.id })}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md bg-surface-secondary/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {sIdx + 1}. {sec.title || t("formBuilder.untitled")}
                    </span>
                    {sec.visibleWhen && (
                      <Badge tone="info">ĐK</Badge>
                    )}
                    {sec.collapsible && (
                      <Badge tone="neutral">Thu gọn</Badge>
                    )}
                  </div>
                  {sec.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {sec.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={sIdx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSection(sIdx, -1);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={sIdx === sections.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSection(sIdx, 1);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={sections.length <= 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSection(sec.id);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Section rows */}
              <div className="space-y-2.5">
                {sec.rows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border py-5 text-center text-xs text-muted-foreground">
                    {t("formBuilder.addFieldHint")}
                  </p>
                ) : (
                  sec.rows.map((row, rIdx) => {
                    const usedCols = row.items.reduce(
                      (sum, x) => sum + x.colSpan,
                      0,
                    );
                    const remainingCols = 12 - usedCols;

                    return (
                      <div
                        key={row.id}
                        className="rounded-md border border-dashed border-border-subtle bg-surface-secondary/20 p-2"
                      >
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                          {row.items.map((item, iIdx) => {
                            const selected =
                              selection?.kind === "item" &&
                              selection.itemId === item.id;
                            const maxAllowedSpan = item.colSpan + remainingCols;

                            return (
                              <div
                                key={item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelect({
                                    kind: "item",
                                    sectionId: sec.id,
                                    rowId: row.id,
                                    itemId: item.id,
                                  });
                                }}
                                className={cn(
                                  colSpanClass(item.colSpan),
                                  "group cursor-pointer rounded-md border bg-surface p-2.5 transition-colors",
                                  selected
                                    ? "border-primary ring-1 ring-primary/25"
                                    : "border-border hover:border-foreground/30",
                                )}
                              >
                                <CanvasItemHeader
                                  item={item}
                                  field={
                                    item.kind === "field"
                                      ? fieldByKey.get(item.fieldKey)
                                      : undefined
                                  }
                                />

                                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-border-subtle pt-1.5">
                                  <div className="flex items-center gap-0.5">
                                    {COL_SPAN_OPTIONS.map((span) => (
                                      <button
                                        key={span}
                                        type="button"
                                        disabled={span > maxAllowedSpan}
                                        title={`Độ rộng: ${span}/12 dòng`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSetItemColSpan(
                                            sec.id,
                                            row.id,
                                            item.id,
                                            span,
                                          );
                                        }}
                                        className={cn(
                                          "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors",
                                          item.colSpan === span
                                            ? "bg-primary text-primary-foreground font-semibold"
                                            : "bg-surface-secondary text-muted-foreground hover:text-foreground disabled:opacity-30",
                                        )}
                                      >
                                        {span}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      title="Di chuyển sang trái"
                                      disabled={iIdx === 0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveItem(sec.id, row.id, item.id, "left");
                                      }}
                                      className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-25"
                                    >
                                      <ArrowLeft size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Di chuyển sang phải"
                                      disabled={iIdx === row.items.length - 1}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveItem(sec.id, row.id, item.id, "right");
                                      }}
                                      className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-25"
                                    >
                                      <ArrowRight size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Di chuyển lên hàng trên"
                                      disabled={rIdx === 0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveItem(sec.id, row.id, item.id, "up");
                                      }}
                                      className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-25"
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Di chuyển xuống hàng dưới"
                                      disabled={rIdx === sec.rows.length - 1}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveItem(sec.id, row.id, item.id, "down");
                                      }}
                                      className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-25"
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Xóa trường này"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteItem(sec.id, row.id, item.id);
                                      }}
                                      className="rounded p-1 text-muted-foreground hover:bg-danger-subtle hover:text-danger"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onAddRow(sec.id)}
                >
                  <Plus size={13} />
                  {t("formBuilder.addRow")}
                </Button>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function CanvasItemHeader({
  item,
  field,
}: {
  item: LayoutItem;
  field?: FieldDraft;
}) {
  const t = useT();

  if (item.kind === "heading") {
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.text || t("formBuilder.headingBlock")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("formBuilder.headingBlock")}
          </p>
        </div>
        {item.visibleWhen && <Badge tone="info">ĐK</Badge>}
      </div>
    );
  }

  if (item.kind === "divider") {
    return (
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-xs text-muted-foreground">
          ── {t("formBuilder.dividerBlock")} ──
        </span>
        {item.visibleWhen && <Badge tone="info">ĐK</Badge>}
      </div>
    );
  }

  if (item.kind === "attachmentSlot") {
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Paperclip size={13} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {item.label}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {item.targetSection === "MAIN"
                ? t("formBuilder.slotMain")
                : t("formBuilder.slotSecondary")}
            </p>
          </div>
        </div>
        {item.visibleWhen && <Badge tone="info">ĐK</Badge>}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {field?.label.trim() || field?.key || item.fieldKey}
          {field?.required && <span className="ml-0.5 text-danger">*</span>}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {field ? t(`fieldType.${field.type}`) : item.fieldKey} · {item.fieldKey}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.readOnly && (
          <Badge tone="neutral" title={t("formBuilder.readOnly")}>
            <Lock size={10} />
          </Badge>
        )}
        {item.visibleWhen && <Badge tone="info">ĐK</Badge>}
      </div>
    </div>
  );
}


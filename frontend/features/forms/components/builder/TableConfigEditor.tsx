"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X, List, Layers, HelpCircle } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type {
  TableAggregateRule,
  TableColumnDef,
  TableColumnType,
  TableFieldConfig,
} from "../../types/form";
import type { FieldDraft } from "../../types/builder";
import { slugifyVietnamese } from "../../lib/slug";

const COLUMN_TYPES: TableColumnType[] = ["TEXT", "NUMBER", "DATE", "SELECT"];

const TYPE_TONES: Record<TableColumnType, "neutral" | "info" | "success" | "warning"> = {
  TEXT: "neutral",
  NUMBER: "info",
  DATE: "warning",
  SELECT: "success",
};

export function TableConfigEditor({
  field,
  allFields,
  onChange,
}: {
  field: FieldDraft;
  allFields: FieldDraft[];
  onChange: (patch: Partial<FieldDraft>) => void;
}) {
  const t = useT();
  const cfg: TableFieldConfig = field.tableConfig ?? { columns: [] };

  const patchCfg = (next: Partial<TableFieldConfig>) =>
    onChange({ tableConfig: { ...cfg, ...next } });

  const updateColumn = (idx: number, patch: Partial<TableColumnDef>) => {
    const columns = cfg.columns.map((col, i) =>
      i === idx ? { ...col, ...patch } : col,
    );
    patchCfg({ columns });
  };

  const handleLabelChange = (idx: number, newLabel: string) => {
    const col = cfg.columns[idx];
    if (!col) return;
    const oldSlug = slugifyVietnamese(col.label);
    const isDefaultKey = !col.key || col.key.startsWith("col_") || col.key === oldSlug;

    if (isDefaultKey && newLabel.trim()) {
      const autoKey = slugifyVietnamese(newLabel) || `col_${idx + 1}`;
      updateColumn(idx, { label: newLabel, key: autoKey });
    } else {
      updateColumn(idx, { label: newLabel });
    }
  };

  const addColumn = () => {
    const idx = cfg.columns.length + 1;
    const nextCol: TableColumnDef = {
      key: `col_${idx}`,
      label: `Cột ${idx}`,
      type: "TEXT",
      required: false,
    };
    patchCfg({ columns: [...cfg.columns, nextCol] });
  };

  const removeColumn = (idx: number) => {
    if (cfg.columns.length <= 1) return;
    patchCfg({ columns: cfg.columns.filter((_, i) => i !== idx) });
  };

  const moveColumn = (idx: number, delta: -1 | 1) => {
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= cfg.columns.length) return;
    const nextCols = [...cfg.columns];
    const [moved] = nextCols.splice(idx, 1);
    nextCols.splice(targetIdx, 0, moved);
    patchCfg({ columns: nextCols });
  };

  const numberFields = allFields.filter(
    (f) => f.type === "NUMBER" && f.key !== field.key,
  );
  const numberColumns = cfg.columns.filter((c) => c.type === "NUMBER");
  const firstAgg: TableAggregateRule | undefined = cfg.summary?.aggregates?.[0];

  const updateFirstAggregate = (
    patch: Partial<TableAggregateRule> | null,
  ) => {
    if (!patch) {
      patchCfg({ summary: undefined });
      return;
    }
    const baseCol =
      firstAgg?.columnKey ?? numberColumns[0]?.key ?? cfg.columns[0]?.key ?? "";
    const nextAgg: TableAggregateRule = {
      columnKey: baseCol,
      op: firstAgg?.op ?? "SUM",
      targetFieldKey: firstAgg?.targetFieldKey,
      ...patch,
    };
    patchCfg({
      summary: {
        label: cfg.summary?.label || t("formRenderer.summaryTotal"),
        aggregates: [nextAgg],
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Cài đặt số dòng bảng ── */}
      <div className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cấu hình dòng dữ liệu
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t("formBuilder.minRows")} hint="Số dòng ít nhất người dùng phải nhập">
            <Input
              type="number"
              min={0}
              value={cfg.minRows ?? 0}
              onChange={(e) =>
                patchCfg({
                  minRows: e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label={t("formBuilder.maxRows")} hint="Số dòng tối đa cho phép">
            <Input
              type="number"
              min={1}
              max={200}
              value={cfg.maxRows ?? 50}
              onChange={(e) =>
                patchCfg({
                  maxRows: e.target.value === "" ? 50 : Number(e.target.value),
                })
              }
            />
          </Field>
        </div>

        <Field label={t("formBuilder.addRowLabel")} hint="Mặc định: + Thêm dòng">
          <Input
            value={cfg.addRowLabel ?? ""}
            placeholder={t("formRenderer.addTableRow")}
            onChange={(e) => patchCfg({ addRowLabel: e.target.value || undefined })}
          />
        </Field>

        <label className="flex items-center gap-2 pt-1 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.showRowNumber !== false}
            onChange={(e) => patchCfg({ showRowNumber: e.target.checked })}
            className="h-4 w-4 rounded accent-primary"
          />
          <span className="font-medium">{t("formBuilder.showRowNumber")}</span>
          <span className="text-muted-foreground text-[11px]">(cột đánh số thứ tự 1, 2, 3...)</span>
        </label>
      </div>

      {/* ── Danh sách cột bảng ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
              {t("formBuilder.tableColumns")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Tổng số {cfg.columns.length} cột trong bảng
            </p>
          </div>
          <Button type="button" variant="outline" size="xs" onClick={addColumn}>
            <Plus size={13} />
            {t("formBuilder.addColumn")}
          </Button>
        </div>

        <div className="space-y-3">
          {cfg.columns.map((col, idx) => (
            <div
              key={idx}
              className="space-y-3 rounded-lg border border-border bg-surface p-3.5 shadow-xs transition-colors hover:border-border-subtle"
            >
              {/* Header card: Số thứ tự + Badge + Nút di chuyển / Xóa */}
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-secondary text-[11px] font-bold text-foreground">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                    {col.label.trim() || `Cột ${idx + 1}`}
                  </span>
                  <Badge tone={TYPE_TONES[col.type]} className="text-[10px] py-0 px-1.5">
                    {t(`fieldType.${col.type}`)}
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Di chuyển cột lên trước"
                    disabled={idx === 0}
                    onClick={() => moveColumn(idx, -1)}
                    className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    title="Di chuyển cột xuống sau"
                    disabled={idx === cfg.columns.length - 1}
                    onClick={() => moveColumn(idx, 1)}
                    className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    title="Xóa cột"
                    disabled={cfg.columns.length <= 1}
                    onClick={() => removeColumn(idx)}
                    className="rounded p-1 text-muted-foreground hover:bg-danger-subtle hover:text-danger disabled:opacity-30 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Tên hiển thị cột: Rộng rãi, toàn bộ chiều rộng */}
              <Field label="Tên hiển thị cột *" hint="Hiển thị trên dòng tiêu đề bảng">
                <Input
                  value={col.label}
                  placeholder="vd: Tên hàng hóa, Số lượng, Đơn giá..."
                  className="h-8.5 text-xs font-medium"
                  onChange={(e) => handleLabelChange(idx, e.target.value)}
                />
              </Field>

              {/* Mã cột (Key) và Loại dữ liệu (Type) */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Mã cột (Key)" hint="Định danh dữ liệu (a-z, 0-9, _)">
                  <Input
                    value={col.key}
                    placeholder="vd: ten_hang"
                    className="h-8 font-mono text-xs"
                    onChange={(e) =>
                      updateColumn(idx, {
                        key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
                      })
                    }
                  />
                </Field>

                <Field label="Loại dữ liệu">
                  <Select
                    value={col.type}
                    className="h-8 text-xs"
                    onChange={(e) => {
                      const nextType = e.target.value as TableColumnType;
                      updateColumn(idx, {
                        type: nextType,
                        options:
                          nextType === "SELECT"
                            ? (col.options && col.options.length > 0
                                ? col.options
                                : [
                                    { label: "Lựa chọn 1", value: "opt_1" },
                                    { label: "Lựa chọn 2", value: "opt_2" },
                                  ])
                            : undefined,
                      });
                    }}
                  >
                    {COLUMN_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {t(`fieldType.${ct}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Tùy chọn cột: Bắt buộc & Độ rộng */}
              <div className="grid grid-cols-2 gap-2 items-center pt-1">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(col.required)}
                    onChange={(e) =>
                      updateColumn(idx, { required: e.target.checked })
                    }
                    className="h-3.5 w-3.5 rounded accent-primary"
                  />
                  <span>Bắt buộc nhập</span>
                </label>

                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">Độ rộng (px):</span>
                  <Input
                    type="number"
                    min={40}
                    max={600}
                    step={10}
                    value={col.width ?? ""}
                    placeholder="Tự động"
                    className="h-7 w-20 text-xs text-right"
                    onChange={(e) =>
                      updateColumn(idx, {
                        width: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              {/* Danh sách lựa chọn khi cột là SELECT */}
              {col.type === "SELECT" && (
                <div className="mt-2 space-y-2 rounded-md border border-border-subtle bg-surface-secondary/30 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">
                      Danh mục lựa chọn trong cột
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        const curOpts = col.options ?? [];
                        const nextIdx = curOpts.length + 1;
                        updateColumn(idx, {
                          options: [
                            ...curOpts,
                            { label: `Lựa chọn ${nextIdx}`, value: `opt_${nextIdx}` },
                          ],
                        });
                      }}
                    >
                      <Plus size={11} />
                      Thêm mục
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {(col.options ?? []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-1.5">
                        <Input
                          value={opt.label}
                          placeholder="Tên mục hiển thị"
                          className="h-7 flex-1 text-xs"
                          onChange={(e) => {
                            const newLbl = e.target.value;
                            const curOpts = [...(col.options ?? [])];
                            const curOpt = curOpts[optIdx];
                            const isDefaultVal =
                              !curOpt.value ||
                              curOpt.value.startsWith("opt_") ||
                              curOpt.value === slugifyVietnamese(curOpt.label);
                            const nextVal = isDefaultVal
                              ? slugifyVietnamese(newLbl) || `opt_${optIdx + 1}`
                              : curOpt.value;

                            curOpts[optIdx] = { label: newLbl, value: nextVal };
                            updateColumn(idx, { options: curOpts });
                          }}
                        />
                        <Input
                          value={opt.value}
                          placeholder="Mã (value)"
                          className="h-7 w-24 font-mono text-[11px]"
                          onChange={(e) => {
                            const curOpts = [...(col.options ?? [])];
                            curOpts[optIdx] = {
                              ...curOpts[optIdx],
                              value: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
                            };
                            updateColumn(idx, { options: curOpts });
                          }}
                        />
                        <button
                          type="button"
                          disabled={(col.options ?? []).length <= 1}
                          onClick={() => {
                            const curOpts = (col.options ?? []).filter((_, i) => i !== optIdx);
                            updateColumn(idx, { options: curOpts });
                          }}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-danger disabled:opacity-30"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center"
          onClick={addColumn}
        >
          <Plus size={14} />
          {t("formBuilder.addColumn")}
        </Button>
      </div>

      {/* ── Tính toán tổng hợp (Summary Rollup) ── */}
      {numberColumns.length > 0 && (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <Field
            label={t("formBuilder.summaryRollup")}
            hint="Tự động tính tổng các cột số và đồng bộ ra chân bảng hoặc trường ngoài"
          >
            <Select
              value={
                firstAgg
                  ? `${firstAgg.columnKey}::${firstAgg.targetFieldKey ?? ""}`
                  : ""
              }
              className="h-8.5 text-xs font-medium"
              onChange={(e) => {
                if (!e.target.value) {
                  updateFirstAggregate(null);
                  return;
                }
                const [columnKey, targetFieldKey] = e.target.value.split("::");
                updateFirstAggregate({
                  columnKey,
                  op: "SUM",
                  targetFieldKey: targetFieldKey || undefined,
                });
              }}
            >
              <option value="">{t("formBuilder.summaryNone")}</option>
              {numberColumns.map((nc) => (
                <option key={nc.key} value={`${nc.key}::`}>
                  SUM({nc.label || nc.key}) — Hiển thị chân bảng (Footer total)
                </option>
              ))}
              {numberColumns.flatMap((nc) =>
                numberFields.map((nf) => (
                  <option key={`${nc.key}-${nf.key}`} value={`${nc.key}::${nf.key}`}>
                    SUM({nc.label || nc.key}) → Cập nhật vào trường "{nf.label || nf.key}"
                  </option>
                )),
              )}
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}

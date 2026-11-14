"use client";

import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";
import type {
  FormFieldView,
  TableColumnDef,
  TableFieldConfig,
} from "../types/form";
import { computeTableAggregateValue } from "../lib/layout";
import type { TableCellErrors } from "../lib/validation";

export type TableFieldRendererProps = {
  field: FormFieldView;
  value: unknown;
  onChange?: (rows: Array<Record<string, unknown>>) => void;
  disabled?: boolean;
  readOnly?: boolean;
  cellErrors?: TableCellErrors;
};

function createEmptyRow(columns: TableColumnDef[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of columns) {
    row[col.key] = "";
  }
  return row;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

/**
 * Repeater / Sub-table renderer for FieldType.TABLE. Supports both interactive
 * row editing (FormRenderer) and clean read-only display (RequestFormData).
 */
export function TableFieldRenderer({
  field,
  value,
  onChange,
  disabled,
  readOnly,
  cellErrors,
}: TableFieldRendererProps) {
  const t = useT();
  const cfg: TableFieldConfig = field.tableConfig ?? { columns: [] };
  const columns = cfg.columns ?? [];
  const rows: Array<Record<string, unknown>> = Array.isArray(value)
    ? (value as Array<Record<string, unknown>>)
    : [];

  const showRowNumber = cfg.showRowNumber !== false;
  const minRows = cfg.minRows ?? (field.required ? 1 : 0);
  const maxRows = cfg.maxRows ?? 50;
  const isLocked = Boolean(disabled || readOnly || !onChange);

  const addRow = () => {
    if (isLocked || rows.length >= maxRows) return;
    onChange?.([...rows, createEmptyRow(columns)]);
  };

  const removeRow = (idx: number) => {
    if (isLocked || rows.length <= minRows) return;
    onChange?.(rows.filter((_, i) => i !== idx));
  };

  const updateCell = (rowIdx: number, colKey: string, nextVal: unknown) => {
    if (isLocked) return;
    onChange?.(
      rows.map((r, i) => (i === rowIdx ? { ...r, [colKey]: nextVal } : r)),
    );
  };

  const aggregatesByCol = new Map<string, { op: "SUM" | "COUNT"; val: number }>();
  for (const agg of cfg.summary?.aggregates ?? []) {
    aggregatesByCol.set(agg.columnKey, {
      op: agg.op,
      val: computeTableAggregateValue(agg.op, agg.columnKey, rows),
    });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[540px] border-collapse text-left text-sm">
          <thead className="border-b border-border bg-surface-secondary text-xs font-semibold text-muted-foreground">
            <tr>
              {showRowNumber && (
                <th className="w-10 px-2.5 py-2 text-center">#</th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: `${col.width}px` } : undefined}
                  className="px-2.5 py-2 text-xs font-semibold text-foreground"
                >
                  {col.label?.trim() || col.key}
                  {!readOnly && col.required && (
                    <span className="ml-0.5 text-danger">*</span>
                  )}
                </th>
              ))}
              {!readOnly && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length + (showRowNumber ? 1 : 0) + (readOnly ? 0 : 1)
                  }
                  className="px-3 py-4 text-center text-xs text-muted-foreground"
                >
                  {t("formRenderer.noRows")}
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => (
                <tr key={rIdx} className="align-top">
                  {showRowNumber && (
                    <td className="px-2.5 py-2.5 text-center text-xs text-muted-foreground tabular-nums">
                      {rIdx + 1}
                    </td>
                  )}
                  {columns.map((col) => {
                    const cellVal = row?.[col.key];
                    const cellErr = cellErrors?.[rIdx]?.[col.key];
                    return (
                      <td key={col.key} className="px-2 py-1.5">
                        {readOnly ? (
                          <div className="py-1 text-sm text-foreground">
                            {formatReadOnlyCell(col, cellVal)}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <EditableCell
                              col={col}
                              value={cellVal}
                              disabled={isLocked}
                              invalid={Boolean(cellErr)}
                              onChange={(v) => updateCell(rIdx, col.key, v)}
                            />
                            {cellErr && (
                              <p className="text-[11px] text-danger">{cellErr}</p>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={isLocked || rows.length <= minRows}
                        onClick={() => removeRow(rIdx)}
                        title={t("common.delete")}
                        className={cn(
                          "rounded p-1.5 text-muted-foreground transition-colors",
                          "hover:bg-surface-secondary hover:text-danger disabled:cursor-not-allowed disabled:opacity-40",
                        )}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {aggregatesByCol.size > 0 && (
            <tfoot className="border-t border-border bg-surface-secondary/60 text-xs font-semibold text-foreground">
              <tr>
                {showRowNumber && <td className="px-2.5 py-2" />}
                {columns.map((col, idx) => {
                  const agg = aggregatesByCol.get(col.key);
                  if (agg) {
                    return (
                      <td key={col.key} className="px-2.5 py-2 tabular-nums">
                        {formatNumber(agg.val)}
                      </td>
                    );
                  }
                  if (idx === 0) {
                    return (
                      <td key={col.key} className="px-2.5 py-2 text-muted-foreground">
                        {cfg.summary?.label || t("formRenderer.summaryTotal")}
                      </td>
                    );
                  }
                  return <td key={col.key} className="px-2.5 py-2" />;
                })}
                {!readOnly && <td className="px-2 py-2" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLocked || rows.length >= maxRows}
          onClick={addRow}
        >
          <Plus size={14} />
          {cfg.addRowLabel || t("formRenderer.addTableRow")}
        </Button>
      )}
    </div>
  );
}

function formatReadOnlyCell(col: TableColumnDef, val: unknown): string {
  if (val == null || val === "") return "—";
  if (col.type === "NUMBER" && typeof val === "number") {
    return formatNumber(val);
  }
  if (col.type === "SELECT") {
    const match = (col.options ?? []).find((o) => o.value === String(val));
    return match ? match.label : String(val);
  }
  return String(val);
}

function EditableCell({
  col,
  value,
  disabled,
  invalid,
  onChange,
}: {
  col: TableColumnDef;
  value: unknown;
  disabled: boolean;
  invalid: boolean;
  onChange: (val: unknown) => void;
}) {
  if (col.type === "NUMBER") {
    return (
      <Input
        type="number"
        disabled={disabled}
        aria-invalid={invalid}
        value={value == null || value === "" ? "" : String(value)}
        min={col.min}
        max={col.max}
        placeholder={col.placeholder}
        className="h-8 text-xs"
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    );
  }

  if (col.type === "DATE") {
    return (
      <Input
        type="date"
        disabled={disabled}
        aria-invalid={invalid}
        value={String(value ?? "")}
        className="h-8 text-xs"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (col.type === "SELECT") {
    return (
      <Select
        disabled={disabled}
        aria-invalid={invalid}
        value={String(value ?? "")}
        className="h-8 text-xs"
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{col.placeholder ?? "—"}</option>
        {(col.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Input
      type="text"
      disabled={disabled}
      aria-invalid={invalid}
      value={String(value ?? "")}
      maxLength={col.maxLength}
      placeholder={col.placeholder}
      className="h-8 text-xs"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}


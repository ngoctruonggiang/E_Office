"use client";

import { Plus, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
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

const COLUMN_TYPES: TableColumnType[] = ["TEXT", "NUMBER", "DATE", "SELECT"];

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
    patchCfg({ columns: cfg.columns.filter((_, i) => i !== idx) });
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t("formBuilder.minRows")}>
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
        <Field label={t("formBuilder.maxRows")}>
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

      <Field label={t("formBuilder.addRowLabel")}>
        <Input
          value={cfg.addRowLabel ?? ""}
          placeholder={t("formRenderer.addTableRow")}
          onChange={(e) => patchCfg({ addRowLabel: e.target.value || undefined })}
        />
      </Field>

      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={cfg.showRowNumber !== false}
          onChange={(e) => patchCfg({ showRowNumber: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        {t("formBuilder.showRowNumber")}
      </label>

      <div className="space-y-2 border-t border-border-subtle pt-3">
        <p className="text-xs font-semibold text-foreground">
          {t("formBuilder.tableColumns")}
        </p>

        {cfg.columns.map((col, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-md border border-border bg-surface-secondary/40 p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <Input
                value={col.label}
                placeholder={t("formBuilder.label")}
                className="h-8 flex-1 text-xs"
                onChange={(e) => updateColumn(idx, { label: e.target.value })}
              />
              <Input
                value={col.key}
                placeholder={t("formBuilder.key")}
                className="h-8 w-28 font-mono text-xs"
                onChange={(e) =>
                  updateColumn(idx, {
                    key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_"),
                  })
                }
              />
              <button
                type="button"
                disabled={cfg.columns.length <= 1}
                onClick={() => removeColumn(idx)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-danger disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={col.type}
                className="h-8 flex-1 text-xs"
                onChange={(e) => {
                  const nextType = e.target.value as TableColumnType;
                  updateColumn(idx, {
                    type: nextType,
                    options:
                      nextType === "SELECT"
                        ? (col.options ?? [{ label: "Option 1", value: "opt_1" }])
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
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(col.required)}
                  onChange={(e) =>
                    updateColumn(idx, { required: e.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-primary"
                />
                {t("formBuilder.required")}
              </label>
            </div>

            {col.type === "SELECT" && (
              <Input
                value={(col.options ?? [])
                  .map((o) => `${o.label}:${o.value}`)
                  .join(", ")}
                placeholder="Label:value, Label2:value2"
                className="h-8 text-xs"
                onChange={(e) => {
                  const opts = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((pair) => {
                      const [lbl, val] = pair.split(":");
                      const cleanVal = (val ?? lbl).trim().replace(/\s+/g, "_");
                      return { label: lbl.trim(), value: cleanVal };
                    });
                  updateColumn(idx, { options: opts });
                }}
              />
            )}
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addColumn}>
          <Plus size={13} />
          {t("formBuilder.addColumn")}
        </Button>
      </div>

      {numberColumns.length > 0 && (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <Field label={t("formBuilder.summaryRollup")}>
            <Select
              value={
                firstAgg
                  ? `${firstAgg.columnKey}::${firstAgg.targetFieldKey ?? ""}`
                  : ""
              }
              className="h-8 text-xs"
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
                  SUM({nc.label}) — Footer only
                </option>
              ))}
              {numberColumns.flatMap((nc) =>
                numberFields.map((nf) => (
                  <option key={`${nc.key}-${nf.key}`} value={`${nc.key}::${nf.key}`}>
                    SUM({nc.label}) → {nf.label || nf.key} ({nf.key})
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


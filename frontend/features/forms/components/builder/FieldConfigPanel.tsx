"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { FieldDraft } from "../../types/builder";
import { VALIDATION_TYPES } from "../../types/builder";
import type { SelectMode, ValidationType } from "../../types/form";
import { TableConfigEditor } from "./TableConfigEditor";
import { slugifyVietnamese } from "../../lib/slug";

export type FieldConfigPanelProps = {
  field: FieldDraft | null;
  allFields: FieldDraft[];
  onChange: (uid: string, patch: Partial<FieldDraft>) => void;
  onRenameKey?: (uid: string, oldKey: string, newKey: string) => void;
};

/** Data & validation settings for a FieldDraft. */
export function FieldConfigPanel({
  field,
  allFields,
  onChange,
  onRenameKey,
}: FieldConfigPanelProps) {
  const t = useT();

  if (!field) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        {t("formBuilder.selectFieldHint")}
      </p>
    );
  }

  const patch = (p: Partial<FieldDraft>) => onChange(field.uid, p);
  const numberOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("formBuilder.config")} · {t(`fieldType.${field.type}`)}
      </p>

      <Field label={t("formBuilder.label")} htmlFor="cfg-label">
        <Input
          id="cfg-label"
          value={field.label}
          placeholder="Nhập tên hiển thị của trường..."
          onChange={(e) => {
            const newLabel = e.target.value;
            const oldSlug = slugifyVietnamese(field.label);
            const isDefaultKey =
              !field.key ||
              field.key.startsWith("field_") ||
              field.key.startsWith("table_") ||
              field.key === oldSlug;

            if (isDefaultKey && newLabel.trim()) {
              const rawKey = slugifyVietnamese(newLabel) || field.key;
              const otherKeys = new Set(
                allFields.filter((f) => f.uid !== field.uid).map((f) => f.key),
              );
              let autoKey = rawKey;
              let suffix = 2;
              while (otherKeys.has(autoKey)) {
                autoKey = `${rawKey}_${suffix++}`;
              }

              if (onRenameKey && autoKey !== field.key) {
                onRenameKey(field.uid, field.key, autoKey);
              }
              patch({ label: newLabel, key: autoKey });
            } else {
              patch({ label: newLabel });
            }
          }}
        />
      </Field>

      <Field
        label={t("formBuilder.key")}
        htmlFor="cfg-key"
        hint="Định danh dùng trong quy trình & tính toán dữ liệu (chỉ chữ, số, _)"
      >
        <Input
          id="cfg-key"
          value={field.key}
          className="font-mono text-xs"
          placeholder="vd: ho_va_ten, tong_tien"
          onChange={(e) => {
            const nextKey = e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
            if (onRenameKey) {
              onRenameKey(field.uid, field.key, nextKey);
            } else {
              patch({ key: nextKey });
            }
          }}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => patch({ required: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        {t("formBuilder.required")}
      </label>

      {field.type === "TEXT" && (
        <>
          <Field label={t("formBuilder.maxLength")} htmlFor="cfg-maxlen">
            <Input
              id="cfg-maxlen"
              type="number"
              value={field.maxLength ?? ""}
              onChange={(e) => patch({ maxLength: numberOrNull(e.target.value) })}
            />
          </Field>
          <Field label={t("formBuilder.placeholder")} htmlFor="cfg-ph">
            <Input
              id="cfg-ph"
              value={field.placeholder ?? ""}
              onChange={(e) => patch({ placeholder: e.target.value || null })}
            />
          </Field>
          <ValidationsEditor field={field} onChange={patch} />
        </>
      )}

      {field.type === "NUMBER" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("formBuilder.min")} htmlFor="cfg-min">
              <Input
                id="cfg-min"
                type="number"
                value={field.min ?? ""}
                onChange={(e) => patch({ min: numberOrNull(e.target.value) })}
              />
            </Field>
            <Field label={t("formBuilder.max")} htmlFor="cfg-max">
              <Input
                id="cfg-max"
                type="number"
                value={field.max ?? ""}
                onChange={(e) => patch({ max: numberOrNull(e.target.value) })}
              />
            </Field>
          </div>
          <Field label={t("formBuilder.placeholder")} htmlFor="cfg-nph">
            <Input
              id="cfg-nph"
              value={field.placeholder ?? ""}
              onChange={(e) => patch({ placeholder: e.target.value || null })}
            />
          </Field>
        </>
      )}

      {field.type === "SELECT" && (
        <>
          <Field label={t("formBuilder.selectMode")}>
            <Select
              value={field.selectMode ?? "SINGLE"}
              onChange={(e) =>
                patch({ selectMode: e.target.value as SelectMode })
              }
            >
              <option value="SINGLE">{t("formBuilder.single")}</option>
              <option value="MULTIPLE">{t("formBuilder.multiple")}</option>
            </Select>
          </Field>
          <OptionsEditor field={field} onChange={patch} />
        </>
      )}

      {field.type === "TABLE" && (
        <TableConfigEditor field={field} allFields={allFields} onChange={patch} />
      )}
    </div>
  );
}

function OptionsEditor({
  field,
  onChange,
}: {
  field: FieldDraft;
  onChange: (p: Partial<FieldDraft>) => void;
}) {
  const t = useT();
  const set = (i: number, patch: Partial<{ label: string; value: string }>) =>
    onChange({
      options: field.options.map((o, idx) =>
        idx === i ? { ...o, ...patch } : o,
      ),
    });

  const moveOption = (idx: number, delta: -1 | 1) => {
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= field.options.length) return;
    const nextOpts = [...field.options];
    const [moved] = nextOpts.splice(idx, 1);
    nextOpts.splice(targetIdx, 0, moved);
    onChange({ options: nextOpts });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {t("formBuilder.options")} ({field.options.length})
          </p>
          <p className="text-[11px] text-muted-foreground">
            Danh sách giá trị để người dùng lựa chọn
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => {
            const nextIdx = field.options.length + 1;
            onChange({
              options: [
                ...field.options,
                {
                  label: `Lựa chọn ${nextIdx}`,
                  value: `option_${nextIdx}`,
                },
              ],
            });
          }}
        >
          <Plus size={12} />
          {t("formBuilder.addOption")}
        </Button>
      </div>

      <div className="space-y-2.5">
        {field.options.map((opt, i) => (
          <div
            key={i}
            className="group rounded-lg border border-border bg-surface p-2.5 shadow-xs transition-colors hover:border-foreground/20 hover:shadow-sm"
          >
            {/* Header: Số thứ tự + Tiêu đề + Nút di chuyển / Xóa */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  Lựa chọn {i + 1}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Di chuyển lên"
                  disabled={i === 0}
                  onClick={() => moveOption(i, -1)}
                  className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-25 transition-colors"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  title="Di chuyển xuống"
                  disabled={i === field.options.length - 1}
                  onClick={() => moveOption(i, 1)}
                  className="rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-foreground disabled:opacity-25 transition-colors"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  title="Xóa lựa chọn"
                  disabled={field.options.length <= 1}
                  onClick={() =>
                    onChange({
                      options: field.options.filter((_, idx) => idx !== i),
                    })
                  }
                  className="rounded p-1 text-muted-foreground hover:bg-danger-subtle hover:text-danger disabled:opacity-25 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Dòng 1: Tên hiển thị (Label) — Rộng rãi, toàn bộ chiều ngang */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">
                Tên hiển thị (Label) *
              </label>
              <Input
                value={opt.label}
                placeholder="vd: Tốt, Khá, Trung bình, Nội bộ phòng ban..."
                className="h-8.5 text-xs font-medium"
                onChange={(e) => {
                  const newLabel = e.target.value;
                  const oldSlug = slugifyVietnamese(opt.label);
                  const isDefaultVal =
                    !opt.value ||
                    opt.value.startsWith("option_") ||
                    opt.value === oldSlug;
                  const nextVal = isDefaultVal
                    ? slugifyVietnamese(newLabel) || `option_${i + 1}`
                    : opt.value;
                  set(i, { label: newLabel, value: nextVal });
                }}
              />
            </div>

            {/* Dòng 2: Mã lưu trữ (Value) — font mono, tự động sinh từ label */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground">
                  Mã giá trị (value)
                </label>
                <span className="text-[10px] text-muted-foreground/70 font-mono">
                  Lưu vào dữ liệu form
                </span>
              </div>
              <Input
                value={opt.value}
                placeholder={`option_${i + 1}`}
                className="h-7.5 font-mono text-xs"
                onChange={(e) =>
                  set(i, {
                    value: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
                  })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidationsEditor({
  field,
  onChange,
}: {
  field: FieldDraft;
  onChange: (p: Partial<FieldDraft>) => void;
}) {
  const t = useT();
  const set = (
    i: number,
    patch: Partial<{ type: ValidationType; regex: string }>,
  ) =>
    onChange({
      validations: field.validations.map((v, idx) =>
        idx === i ? { ...v, ...patch } : v,
      ),
    });

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        {t("formBuilder.validations")}
      </p>
      {field.validations.map((v, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
          <div className="flex items-center gap-2">
            <Select
              value={v.type}
              onChange={(e) =>
                set(i, { type: e.target.value as ValidationType })
              }
            >
              {VALIDATION_TYPES.map((vt) => (
                <option key={vt} value={vt}>
                  {vt}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() =>
                onChange({
                  validations: field.validations.filter((_, idx) => idx !== i),
                })
              }
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-surface-secondary hover:text-danger"
            >
              <X size={15} />
            </button>
          </div>
          {v.type === "REGEX" && (
            <Input
              value={v.regex}
              placeholder={t("formBuilder.regex")}
              onChange={(e) => set(i, { regex: e.target.value })}
            />
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            validations: [...field.validations, { type: "EMAIL", regex: "" }],
          })
        }
      >
        <Plus size={14} />
        {t("formBuilder.addValidation")}
      </Button>
    </div>
  );
}

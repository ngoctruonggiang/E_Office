"use client";

import { Plus, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { FieldDraft } from "../../types/builder";
import { VALIDATION_TYPES } from "../../types/builder";
import type { SelectMode, ValidationType } from "../../types/form";

export type FieldConfigPanelProps = {
  field: FieldDraft | null;
  onChange: (uid: string, patch: Partial<FieldDraft>) => void;
};

/** Right column: settings for the currently selected field. */
export function FieldConfigPanel({ field, onChange }: FieldConfigPanelProps) {
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
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("formBuilder.config")} · {t(`fieldType.${field.type}`)}
      </p>

      <Field label={t("formBuilder.label")} htmlFor="cfg-label">
        <Input
          id="cfg-label"
          value={field.label}
          onChange={(e) => patch({ label: e.target.value })}
        />
      </Field>

      <Field
        label={t("formBuilder.key")}
        htmlFor="cfg-key"
        hint={t("formBuilder.keyHint")}
      >
        <Input
          id="cfg-key"
          value={field.key}
          onChange={(e) =>
            patch({ key: e.target.value.replace(/\s+/g, "_") })
          }
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

      {/* TEXT */}
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

      {/* NUMBER */}
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

      {/* SELECT */}
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

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        {t("formBuilder.options")}
      </p>
      {field.options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt.label}
            placeholder={t("formBuilder.optionLabel")}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <Input
            value={opt.value}
            placeholder={t("formBuilder.optionValue")}
            onChange={(e) =>
              set(i, { value: e.target.value.replace(/\s+/g, "_") })
            }
          />
          <button
            type="button"
            onClick={() =>
              onChange({ options: field.options.filter((_, idx) => idx !== i) })
            }
            className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            options: [
              ...field.options,
              {
                label: `Option ${field.options.length + 1}`,
                value: `option_${field.options.length + 1}`,
              },
            ],
          })
        }
      >
        <Plus size={14} />
        {t("formBuilder.addOption")}
      </Button>
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
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
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

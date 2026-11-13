"use client";

import { useT } from "@/components/providers/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { FormFieldView } from "../types/form";
import type { TableCellErrors } from "../lib/validation";
import { TableFieldRenderer } from "./TableFieldRenderer";

export type FormFieldRendererProps = {
  field: FormFieldView;
  value: unknown;
  error?: string;
  cellErrors?: TableCellErrors;
  disabled?: boolean;
  readOnly?: boolean;
  helpText?: string;
  autoComputed?: boolean;
  onChange: (value: unknown) => void;
};

/** Renders a single form field using GAFOOD × RAMP UI primitives. */
export function FormFieldRenderer({
  field,
  value,
  error,
  cellErrors,
  disabled,
  readOnly,
  helpText,
  autoComputed,
  onChange,
}: FormFieldRendererProps) {
  const t = useT();
  const id = `field-${field.key}`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;
  const invalid = Boolean(error);
  const effectiveDisabled = Boolean(disabled || readOnly || autoComputed);

  const labelNode = (
    <span className="inline-flex items-center gap-1.5">
      <span>{field.label}</span>
      {autoComputed && (
        <Badge tone="info">{t("formRenderer.autoComputed")}</Badge>
      )}
    </span>
  );

  return (
    <Field
      label={labelNode}
      htmlFor={id}
      required={field.required && !readOnly && !autoComputed}
      error={error}
      hint={helpText}
    >
      <Control
        id={id}
        field={field}
        value={value}
        disabled={effectiveDisabled}
        invalid={invalid}
        describedBy={describedBy}
        cellErrors={cellErrors}
        onChange={onChange}
      />
    </Field>
  );
}

type ControlProps = {
  id: string;
  field: FormFieldView;
  value: unknown;
  disabled?: boolean;
  invalid: boolean;
  describedBy?: string;
  cellErrors?: TableCellErrors;
  onChange: (value: unknown) => void;
};

function Control({
  id,
  field,
  value,
  disabled,
  invalid,
  describedBy,
  cellErrors,
  onChange,
}: ControlProps) {
  switch (field.type) {
    case "TEXT":
      return (
        <Input
          id={id}
          type="text"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={String(value ?? "")}
          maxLength={field.maxLength ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "DATE":
      return (
        <Input
          id={id}
          type="date"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "NUMBER":
      return (
        <Input
          id={id}
          type="number"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={value == null || value === "" ? "" : String(value)}
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
        />
      );

    case "SELECT":
      if (field.selectMode === "MULTIPLE") {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div
            role="group"
            aria-describedby={describedBy}
            className="space-y-1.5 rounded-md border border-border bg-input-background p-2.5"
          >
            {field.options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
                    className="h-4 w-4 accent-primary"
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...selected, opt.value]
                          : selected.filter((v) => v !== opt.value),
                      )
                    }
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        );
      }
      return (
        <Select
          id={id}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {field.options.map((opt) => (
            <option key={opt.id} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      );

    case "TABLE":
      return (
        <TableFieldRenderer
          field={field}
          value={value}
          disabled={disabled}
          cellErrors={cellErrors}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
}

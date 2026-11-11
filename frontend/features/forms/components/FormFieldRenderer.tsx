"use client";

import type { FormFieldView } from "../types/form";

export type FormFieldRendererProps = {
  field: FormFieldView;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (value: unknown) => void;
};

const controlClass =
  "w-full rounded-md border border-black/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 disabled:opacity-50 dark:border-white/15";

/** Renders a single form field (label + type-specific control + error). */
export function FormFieldRenderer({
  field,
  value,
  error,
  disabled,
  onChange,
}: FormFieldRendererProps) {
  const id = `field-${field.key}`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;
  const invalid = Boolean(error);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      <Control
        id={id}
        field={field}
        value={value}
        disabled={disabled}
        invalid={invalid}
        describedBy={describedBy}
        onChange={onChange}
      />

      {error && (
        <p id={errorId} className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

type ControlProps = {
  id: string;
  field: FormFieldView;
  value: unknown;
  disabled?: boolean;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: unknown) => void;
};

function Control({
  id,
  field,
  value,
  disabled,
  invalid,
  describedBy,
  onChange,
}: ControlProps) {
  const shared = {
    id,
    disabled,
    "aria-invalid": invalid,
    "aria-describedby": describedBy,
    className: controlClass,
  };

  switch (field.type) {
    case "TEXT":
      return (
        <input
          {...shared}
          type="text"
          value={String(value ?? "")}
          maxLength={field.maxLength ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "DATE":
      return (
        <input
          {...shared}
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "NUMBER":
      return (
        <input
          {...shared}
          type="number"
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
            className="space-y-1.5"
          >
            {field.options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
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
        <select
          {...shared}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {field.placeholder ?? "Select…"}
          </option>
          {field.options.map((opt) => (
            <option key={opt.id} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    default:
      return null;
  }
}

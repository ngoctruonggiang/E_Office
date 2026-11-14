import type {
  FormFieldView,
  FormValues,
  LayoutSchemaV1,
  TableColumnDef,
} from "../types/form";
import { computeVisibleFieldKeys, isValueEmpty } from "./layout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{6,}$/;

export function isValidDateString(val: unknown): boolean {
  if (typeof val !== "string" || !val.trim()) return false;
  if (!Number.isNaN(Date.parse(val))) return true;
  // Support DD/MM/YYYY or DD-MM-YYYY (Vietnamese / European formats)
  const parts = val.trim().split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      const dt = new Date(y, m - 1, d);
      return !Number.isNaN(dt.getTime());
    }
  }
  return false;
}

export type TableCellErrors = Record<number, Record<string, string>>;

function validateTableCell(
  col: TableColumnDef,
  val: unknown,
): string | null {
  if (col.required && isValueEmpty(val)) {
    return `${col.label} is required`;
  }
  if (isValueEmpty(val)) return null;

  switch (col.type) {
    case "TEXT": {
      const text = String(val);
      const maxLen = col.maxLength ?? 250;
      if (text.length > maxLen) {
        return `${col.label} must be at most ${maxLen} characters`;
      }
      break;
    }
    case "NUMBER": {
      const num = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(num)) return `${col.label} must be a number`;
      if (col.min != null && num < col.min) {
        return `${col.label} must be at least ${col.min}`;
      }
      if (col.max != null && num > col.max) {
        return `${col.label} must be at most ${col.max}`;
      }
      break;
    }
    case "DATE":
      if (!isValidDateString(val)) {
        return `${col.label} must be a valid date`;
      }
      break;
    case "SELECT": {
      const allowed = new Set((col.options ?? []).map((o) => o.value));
      if (allowed.size > 0 && !allowed.has(String(val))) {
        return `${col.label} has an invalid selection`;
      }
      break;
    }
  }
  return null;
}

export function validateTableField(
  field: FormFieldView,
  value: unknown,
): { fieldError: string | null; cellErrors: TableCellErrors } {
  const cellErrors: TableCellErrors = {};
  const rows = Array.isArray(value) ? value : [];
  const cfg = field.tableConfig;

  const minRows = cfg?.minRows ?? (field.required ? 1 : 0);
  const maxRows = cfg?.maxRows ?? 50;

  if (rows.length < minRows) {
    return {
      fieldError: `${field.label} requires at least ${minRows} row(s)`,
      cellErrors,
    };
  }
  if (rows.length > maxRows) {
    return {
      fieldError: `${field.label} allows at most ${maxRows} row(s)`,
      cellErrors,
    };
  }

  let hasCellError = false;
  if (cfg?.columns) {
    rows.forEach((rawRow, rIdx) => {
      const row =
        rawRow && typeof rawRow === "object"
          ? (rawRow as Record<string, unknown>)
          : {};
      for (const col of cfg.columns) {
        const msg = validateTableCell(col, row[col.key]);
        if (msg) {
          hasCellError = true;
          if (!cellErrors[rIdx]) cellErrors[rIdx] = {};
          cellErrors[rIdx][col.key] = msg;
        }
      }
    });
  }

  return {
    fieldError: hasCellError ? `${field.label} has invalid cell values` : null,
    cellErrors,
  };
}

/** Validate a single field value. Returns an error message or `null`. */
export function validateField(
  field: FormFieldView,
  value: unknown,
): string | null {
  if (field.type === "TABLE") {
    return validateTableField(field, value).fieldError;
  }

  if (field.required && isValueEmpty(value)) {
    return `${field.label} is required`;
  }
  if (isValueEmpty(value)) return null;

  switch (field.type) {
    case "TEXT": {
      const text = String(value);
      if (field.maxLength != null && text.length > field.maxLength) {
        return `${field.label} must be at most ${field.maxLength} characters`;
      }
      break;
    }
    case "NUMBER": {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) return `${field.label} must be a number`;
      if (field.min != null && num < field.min) {
        return `${field.label} must be at least ${field.min}`;
      }
      if (field.max != null && num > field.max) {
        return `${field.label} must be at most ${field.max}`;
      }
      break;
    }
    case "SELECT": {
      const allowed = new Set(field.options.map((o) => o.value));
      const selected = Array.isArray(value) ? value : [value];
      if (allowed.size > 0 && selected.some((v) => !allowed.has(String(v)))) {
        return `${field.label} has an invalid selection`;
      }
      break;
    }
    case "DATE":
      if (!isValidDateString(value)) {
        return `${field.label} must be a valid date`;
      }
      break;
  }

  for (const rule of field.validations) {
    const text = String(value);
    if (rule.type === "EMAIL" && !EMAIL_RE.test(text)) {
      return `${field.label} must be a valid email`;
    }
    if (rule.type === "PHONE" && !PHONE_RE.test(text)) {
      return `${field.label} must be a valid phone number`;
    }
    if (rule.type === "REGEX" && rule.regex) {
      try {
        if (!new RegExp(rule.regex).test(text)) {
          return `${field.label} is invalid`;
        }
      } catch {
        // Ignore malformed regex coming from the backend.
      }
    }
  }

  return null;
}

/** Validate all visible fields. Returns top-level errors & TABLE per-cell errors. */
export function validateFormWithDetails(
  fields: FormFieldView[],
  values: FormValues,
  layoutSchema?: LayoutSchemaV1 | null,
): {
  errors: Record<string, string>;
  tableErrors: Record<string, TableCellErrors>;
  visibleKeys: Set<string>;
} {
  const visibleKeys = computeVisibleFieldKeys(fields, layoutSchema, values);
  const errors: Record<string, string> = {};
  const tableErrors: Record<string, TableCellErrors> = {};

  for (const field of fields) {
    if (!visibleKeys.has(field.key)) continue;
    if (field.type === "TABLE") {
      const { fieldError, cellErrors } = validateTableField(
        field,
        values[field.key],
      );
      if (fieldError) errors[field.key] = fieldError;
      if (Object.keys(cellErrors).length > 0) {
        tableErrors[field.key] = cellErrors;
      }
    } else {
      const error = validateField(field, values[field.key]);
      if (error) errors[field.key] = error;
    }
  }

  return { errors, tableErrors, visibleKeys };
}

/** Backward-compatible map of `field.key` → error message. */
export function validateForm(
  fields: FormFieldView[],
  values: FormValues,
  layoutSchema?: LayoutSchemaV1 | null,
): Record<string, string> {
  return validateFormWithDetails(fields, values, layoutSchema).errors;
}

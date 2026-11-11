import type { FormFieldView, FormValues } from "../types/form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{6,}$/;

function isEmpty(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Validate a single field value. Returns an error message or `null`. */
export function validateField(
  field: FormFieldView,
  value: unknown,
): string | null {
  if (field.required && isEmpty(value)) {
    return `${field.label} is required`;
  }
  // Optional and empty → nothing more to check.
  if (isEmpty(value)) return null;

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
      if (Number.isNaN(num)) return `${field.label} must be a number`;
      if (field.min != null && num < field.min) {
        return `${field.label} must be at least ${field.min}`;
      }
      if (field.max != null && num > field.max) {
        return `${field.label} must be at most ${field.max}`;
      }
      break;
    }
    case "SELECT": {
      // Selected values must come from the option set.
      const allowed = new Set(field.options.map((o) => o.value));
      const selected = Array.isArray(value) ? value : [value];
      if (selected.some((v) => !allowed.has(String(v)))) {
        return `${field.label} has an invalid selection`;
      }
      break;
    }
    case "DATE":
      break;
  }

  // Format validations (applied to the stringified value).
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

/** Validate all fields. Returns a map of `field.key` → error message. */
export function validateForm(
  fields: FormFieldView[],
  values: FormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = validateField(field, values[field.key]);
    if (error) errors[field.key] = error;
  }
  return errors;
}

import type {
  FormDetail,
  FormFieldView,
  FormValues,
  RequestValue,
} from "../types/form";

/** The empty value for a field when there is no default or initial value. */
function emptyValue(field: FormFieldView): unknown {
  if (field.type === "SELECT" && field.selectMode === "MULTIPLE") return [];
  return "";
}

/**
 * Build the initial form state. Precedence per field:
 * `initial[key]` → `field.defaultValue` → an empty value for the field type.
 */
export function buildInitialValues(
  form: FormDetail,
  initial?: FormValues,
): FormValues {
  const values: FormValues = {};
  for (const field of form.fields) {
    if (initial && field.key in initial) {
      values[field.key] = initial[field.key];
    } else if (field.defaultValue != null) {
      values[field.key] = field.defaultValue;
    } else {
      values[field.key] = emptyValue(field);
    }
  }
  return values;
}

/** Convert form state into the EAV array the backend expects. */
export function toRequestValues(values: FormValues): RequestValue[] {
  return Object.entries(values).map(([fieldKey, value]) => ({
    fieldKey,
    value,
  }));
}

/** Convert a request's EAV values back into keyed form state (for editing). */
export function fromRequestValues(values: RequestValue[]): FormValues {
  const result: FormValues = {};
  for (const { fieldKey, value } of values) result[fieldKey] = value;
  return result;
}

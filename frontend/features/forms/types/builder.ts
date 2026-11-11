import type {
  FieldType,
  FormFieldInput,
  FormFieldView,
  SelectMode,
  ValidationType,
} from "./form";

/** Local, editable field model used by the form builder. */
export type FieldDraft = {
  /** Stable local id for React keys + selection (not sent to the API). */
  uid: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  maxLength: number | null;
  placeholder: string | null;
  min: number | null;
  max: number | null;
  selectMode: SelectMode | null;
  options: { label: string; value: string }[];
  validations: { type: ValidationType; regex: string }[];
};

let counter = 0;
export function uid(): string {
  counter += 1;
  return `f${Date.now().toString(36)}_${counter}`;
}

/** A blank field of the given type, with sensible per-type defaults. */
export function newField(type: FieldType, key: string): FieldDraft {
  return {
    uid: uid(),
    key,
    label: "",
    type,
    required: false,
    maxLength: type === "TEXT" ? 250 : null,
    placeholder: null,
    min: null,
    max: null,
    selectMode: type === "SELECT" ? "SINGLE" : null,
    options:
      type === "SELECT"
        ? [{ label: "Option 1", value: "option_1" }]
        : [],
    validations: [],
  };
}

/** Map a loaded form field (edit mode) into an editable draft. */
export function draftFromView(v: FormFieldView): FieldDraft {
  return {
    uid: uid(),
    key: v.key,
    label: v.label,
    type: v.type,
    required: v.required,
    maxLength: v.maxLength,
    placeholder: v.placeholder,
    min: v.min,
    max: v.max,
    selectMode: v.selectMode,
    options: v.options.map((o) => ({ label: o.label, value: o.value })),
    validations: v.validations.map((vl) => ({
      type: vl.type,
      regex: vl.regex ?? "",
    })),
  };
}

/** Map a draft into the API field input, omitting irrelevant/empty extras. */
export function toFieldInput(d: FieldDraft): FormFieldInput {
  const out: FormFieldInput = {
    key: d.key.trim(),
    label: d.label.trim(),
    type: d.type,
    required: d.required,
  };

  if (d.type === "TEXT") {
    if (d.maxLength != null) out.maxLength = d.maxLength;
    if (d.placeholder) out.placeholder = d.placeholder;
    const vals = d.validations
      .filter((v) => v.type)
      .map((v) => (v.type === "REGEX" ? { type: v.type, regex: v.regex } : { type: v.type }));
    if (vals.length) out.validations = vals;
  }

  if (d.type === "NUMBER") {
    if (d.min != null) out.min = d.min;
    if (d.max != null) out.max = d.max;
    if (d.placeholder) out.placeholder = d.placeholder;
  }

  if (d.type === "SELECT") {
    out.selectMode = d.selectMode ?? "SINGLE";
    out.options = d.options.filter((o) => o.value.trim() && o.label.trim());
  }

  return out;
}

export type FieldTypeMeta = { type: FieldType; labelKey: string; icon: string };

export const FIELD_TYPES: FieldType[] = ["TEXT", "NUMBER", "DATE", "SELECT"];
export const VALIDATION_TYPES: ValidationType[] = ["EMAIL", "PHONE", "REGEX"];

// Mirrors the backend FormDetailDto (be/src/form-builder/dto/form-detail.dto.ts)
// and the request EAV contract (be/src/request/dto/create-request.dto.ts).

export type FieldType = "TEXT" | "DATE" | "NUMBER" | "SELECT";
export type SelectMode = "SINGLE" | "MULTIPLE";
export type ValidationType = "EMAIL" | "PHONE" | "REGEX";

export type FieldOptionView = {
  id: string;
  label: string;
  value: string;
};

export type FieldValidationView = {
  type: ValidationType;
  regex: string | null;
};

export type FormFieldView = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: unknown;
  maxLength: number | null;
  placeholder: string | null;
  min: number | null;
  max: number | null;
  selectMode: SelectMode | null;
  options: FieldOptionView[];
  validations: FieldValidationView[];
};

/** Assembled, render-ready form (GET /forms/:id). */
export type FormDetail = {
  id: string;
  name: string;
  flowId: string | null;
  version: number;
  versionId: string;
  fields: FormFieldView[];
};

/** List item — one form category (GET /forms). */
export type FormSummary = {
  id: string;
  name: string;
  latestVersion: number;
  requestCount: number;
  createdAt: string;
};

/** One field in a create/update payload — mirrors be FormFieldInput. */
export type FormFieldInput = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  maxLength?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  selectMode?: SelectMode;
  options?: { label: string; value: string }[];
  validations?: { type: ValidationType; regex?: string }[];
};

/** Body for POST /forms and PATCH /forms/:id. */
export type FormInput = {
  name: string;
  fields: FormFieldInput[];
};

/** Local form state, keyed by field `key`. */
export type FormValues = Record<string, unknown>;

/** One EAV value in the submit payload (POST /requests). */
export type RequestValue = {
  fieldKey: string;
  value: unknown;
};

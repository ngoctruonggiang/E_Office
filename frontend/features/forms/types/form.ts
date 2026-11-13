// Mirrors the backend FormDetailDto (backend/src/modules/form-builder/dto/form-detail.dto.ts)
// and LayoutSchemaV1 contract (E_Office_Docs/02-specs/phase-2-form-layout-engine/layout-schema-spec.md).

export type FieldType = "TEXT" | "DATE" | "NUMBER" | "SELECT" | "TABLE";
export type SelectMode = "SINGLE" | "MULTIPLE";
export type ValidationType = "EMAIL" | "PHONE" | "REGEX";

export type VisibilityOperator =
  | "eq"
  | "neq"
  | "in"
  | "notIn"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "empty"
  | "notEmpty";

export type VisibilityCondition = {
  fieldKey: string;
  op: VisibilityOperator;
  value?: string | number | boolean | Array<string | number>;
};

export type VisibilityRuleGroup = {
  mode: "all" | "any";
  rules: VisibilityCondition[];
};

export type LayoutFieldItem = {
  id: string;
  kind: "field";
  fieldKey: string;
  colSpan: number;
  helpText?: string;
  readOnly?: boolean;
  visibleWhen?: VisibilityRuleGroup;
};

export type LayoutHeadingItem = {
  id: string;
  kind: "heading";
  text: string;
  subtitle?: string;
  colSpan: number;
  visibleWhen?: VisibilityRuleGroup;
};

export type LayoutDividerItem = {
  id: string;
  kind: "divider";
  colSpan: number;
  visibleWhen?: VisibilityRuleGroup;
};

export type LayoutAttachmentSlotItem = {
  id: string;
  kind: "attachmentSlot";
  slotKey: string;
  label: string;
  description?: string;
  targetSection: "MAIN" | "SECONDARY";
  required?: boolean;
  acceptMimeTypes?: string[];
  colSpan: number;
  visibleWhen?: VisibilityRuleGroup;
};

export type LayoutItem =
  | LayoutFieldItem
  | LayoutHeadingItem
  | LayoutDividerItem
  | LayoutAttachmentSlotItem;

export type LayoutRow = {
  id: string;
  items: LayoutItem[];
};

export type LayoutSection = {
  id: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  visibleWhen?: VisibilityRuleGroup;
  rows: LayoutRow[];
};

export type LayoutSchemaV1 = {
  schemaVersion: 1;
  settings?: {
    columns?: 12;
    labelPlacement?: "top" | "left";
    showSectionNumbers?: boolean;
  };
  sections: LayoutSection[];
};

export type TableColumnType = "TEXT" | "NUMBER" | "DATE" | "SELECT";

export type TableColumnDef = {
  key: string;
  label: string;
  type: TableColumnType;
  width?: number;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
};

export type TableAggregateRule = {
  columnKey: string;
  op: "SUM" | "COUNT";
  targetFieldKey?: string;
};

export type TableFieldConfig = {
  columns: TableColumnDef[];
  minRows?: number;
  maxRows?: number;
  addRowLabel?: string;
  showRowNumber?: boolean;
  summary?: {
    label?: string;
    aggregates: TableAggregateRule[];
  };
};

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
  tableConfig: TableFieldConfig | null;
  options: FieldOptionView[];
  validations: FieldValidationView[];
};

/** Assembled, render-ready form (GET /forms/:id or GET /forms/versions/:versionId). */
export type FormDetail = {
  id: string;
  name: string;
  flowId?: string | null;
  version: number;
  versionId: string;
  layoutSchema: LayoutSchemaV1 | null;
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

/** One field in a create/update payload — mirrors backend FormFieldInput. */
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
  tableConfig?: TableFieldConfig | null;
  options?: { label: string; value: string }[];
  validations?: { type: ValidationType; regex?: string }[];
};

/** Body for POST /forms and PATCH /forms/:id. */
export type FormInput = {
  name: string;
  fields: FormFieldInput[];
  layoutSchema?: LayoutSchemaV1 | null;
};

/** Local form state, keyed by field `key`. */
export type FormValues = Record<string, unknown>;

/** One EAV value in the submit payload (POST /requests). */
export type RequestValue = {
  fieldKey: string;
  value: unknown;
};

// Public surface of the forms feature.
export { FormRenderer } from "./components/FormRenderer";
export type { FormRendererProps } from "./components/FormRenderer";
export { FormFieldRenderer } from "./components/FormFieldRenderer";
export { TableFieldRenderer } from "./components/TableFieldRenderer";

export { getForm, getFormVersion, submitRequest } from "./api/forms";
export type { SubmitRequestInput } from "./api/forms";
export {
  useFormDefinition,
  useFormVersion,
} from "./hooks/useFormDefinition";

export {
  validateField,
  validateForm,
  validateFormWithDetails,
} from "./lib/validation";
export {
  buildInitialValues,
  toRequestValues,
  fromRequestValues,
  filterVisibleValues,
} from "./lib/values";
export {
  normalizeLayoutSchema,
  evaluateVisibility,
  computeVisibleFieldKeys,
  computeTableAggregateValue,
  applyTableAggregates,
} from "./lib/layout";

export type {
  FormDetail,
  FormFieldView,
  FieldOptionView,
  FieldValidationView,
  FieldType,
  SelectMode,
  ValidationType,
  LayoutSchemaV1,
  LayoutSection,
  LayoutRow,
  LayoutItem,
  LayoutFieldItem,
  LayoutHeadingItem,
  LayoutDividerItem,
  LayoutAttachmentSlotItem,
  VisibilityOperator,
  VisibilityCondition,
  VisibilityRuleGroup,
  TableColumnType,
  TableColumnDef,
  TableAggregateRule,
  TableFieldConfig,
  FormValues,
  RequestValue,
} from "./types/form";

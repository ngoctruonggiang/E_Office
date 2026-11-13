import type {
  FieldType,
  FormFieldInput,
  FormFieldView,
  LayoutAttachmentSlotItem,
  LayoutDividerItem,
  LayoutFieldItem,
  LayoutHeadingItem,
  LayoutRow,
  LayoutSchemaV1,
  LayoutSection,
  SelectMode,
  TableFieldConfig,
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
  tableConfig: TableFieldConfig | null;
  options: { label: string; value: string }[];
  validations: { type: ValidationType; regex: string }[];
};

export type BuilderSelection =
  | { kind: "section"; sectionId: string }
  | { kind: "item"; sectionId: string; rowId: string; itemId: string }
  | null;

let counter = 0;
export function uid(prefix = "f"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function defaultTableConfig(): TableFieldConfig {
  return {
    showRowNumber: true,
    minRows: 1,
    maxRows: 50,
    addRowLabel: "",
    columns: [
      { key: "ten_hang", label: "Mục / Nội dung", type: "TEXT", required: true },
      { key: "so_tien", label: "Giá trị", type: "NUMBER", required: true, min: 0 },
    ],
  };
}

/** A blank field of the given type, with sensible per-type defaults. */
export function newField(type: FieldType, key: string): FieldDraft {
  return {
    uid: uid("fld"),
    key,
    label: "",
    type,
    required: false,
    maxLength: type === "TEXT" ? 250 : null,
    placeholder: null,
    min: null,
    max: null,
    selectMode: type === "SELECT" ? "SINGLE" : null,
    tableConfig: type === "TABLE" ? defaultTableConfig() : null,
    options:
      type === "SELECT" ? [{ label: "Option 1", value: "option_1" }] : [],
    validations: [],
  };
}

/** Map a loaded form field (edit mode) into an editable draft. */
export function draftFromView(v: FormFieldView): FieldDraft {
  return {
    uid: uid("fld"),
    key: v.key,
    label: v.label,
    type: v.type,
    required: v.required,
    maxLength: v.maxLength,
    placeholder: v.placeholder,
    min: v.min,
    max: v.max,
    selectMode: v.selectMode,
    tableConfig:
      v.type === "TABLE" ? (v.tableConfig ?? defaultTableConfig()) : null,
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
      .map((v) =>
        v.type === "REGEX" ? { type: v.type, regex: v.regex } : { type: v.type },
      );
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

  if (d.type === "TABLE" && d.tableConfig) {
    out.tableConfig = d.tableConfig;
  }

  return out;
}

/** Convert an editable FieldDraft into FormFieldView for Live Preview. */
export function draftToFieldView(d: FieldDraft): FormFieldView {
  return {
    id: d.uid,
    key: d.key.trim() || d.uid,
    label: d.label.trim() || d.key || "(untitled)",
    type: d.type,
    required: d.required,
    defaultValue: null,
    maxLength: d.maxLength,
    placeholder: d.placeholder,
    min: d.min,
    max: d.max,
    selectMode: d.selectMode,
    tableConfig: d.type === "TABLE" ? d.tableConfig : null,
    options: d.options.map((o, i) => ({
      id: `${d.uid}_opt_${i}`,
      label: o.label,
      value: o.value,
    })),
    validations: d.validations
      .filter((v) => v.type)
      .map((v) => ({ type: v.type, regex: v.type === "REGEX" ? v.regex : null })),
  };
}

export function newSection(title = "Thông tin chung"): LayoutSection {
  return {
    id: uid("sec"),
    title,
    rows: [],
  };
}

export function newFieldLayoutItem(
  fieldKey: string,
  colSpan = 12,
): LayoutFieldItem {
  return {
    id: uid("it"),
    kind: "field",
    fieldKey,
    colSpan,
  };
}

export function newHeadingItem(): LayoutHeadingItem {
  return {
    id: uid("hd"),
    kind: "heading",
    text: "Tiêu đề phân khu",
    colSpan: 12,
  };
}

export function newDividerItem(): LayoutDividerItem {
  return {
    id: uid("div"),
    kind: "divider",
    colSpan: 12,
  };
}

export function newAttachmentSlotItem(slotKey: string): LayoutAttachmentSlotItem {
  return {
    id: uid("slot"),
    kind: "attachmentSlot",
    slotKey,
    label: "Tài liệu đính kèm",
    targetSection: "SECONDARY",
    required: false,
    colSpan: 12,
  };
}

/**
 * Append a LayoutItem into target section: fits into the last row if remaining
 * colSpan >= item.colSpan, otherwise creates a new row.
 */
export function appendItemToSection(
  sections: LayoutSection[],
  targetSectionId: string | null,
  item:
    | LayoutFieldItem
    | LayoutHeadingItem
    | LayoutDividerItem
    | LayoutAttachmentSlotItem,
): { sections: LayoutSection[]; sectionId: string; rowId: string } {
  const baseSections =
    sections.length > 0 ? sections : [newSection("Thông tin chung")];
  const secId =
    targetSectionId && baseSections.some((s) => s.id === targetSectionId)
      ? targetSectionId
      : baseSections[baseSections.length - 1].id;

  let chosenRowId = "";
  const nextSections = baseSections.map((sec) => {
    if (sec.id !== secId) return sec;
    const rows = [...sec.rows];
    const lastRow = rows[rows.length - 1];
    const lastUsed = lastRow
      ? lastRow.items.reduce((sum, x) => sum + x.colSpan, 0)
      : 12;

    if (lastRow && lastUsed + item.colSpan <= 12) {
      chosenRowId = lastRow.id;
      rows[rows.length - 1] = {
        ...lastRow,
        items: [...lastRow.items, item],
      };
    } else {
      const createdRow: LayoutRow = { id: uid("row"), items: [item] };
      chosenRowId = createdRow.id;
      rows.push(createdRow);
    }
    return { ...sec, rows };
  });

  return { sections: nextSections, sectionId: secId, rowId: chosenRowId };
}

export function buildLayoutPayload(sections: LayoutSection[]): LayoutSchemaV1 {
  return {
    schemaVersion: 1,
    settings: {
      columns: 12,
      labelPlacement: "top",
      showSectionNumbers: true,
    },
    sections: sections.map((sec) => ({
      ...sec,
      rows: sec.rows.filter((r) => r.items.length > 0),
    })),
  };
}

export const FIELD_TYPES: FieldType[] = [
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "TABLE",
];
export const VALIDATION_TYPES: ValidationType[] = ["EMAIL", "PHONE", "REGEX"];
export const COL_SPAN_OPTIONS = [3, 4, 6, 8, 12] as const;

export type VisibilityOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'notIn'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'empty'
  | 'notEmpty';

export interface VisibilityCondition {
  fieldKey: string;
  op: VisibilityOperator;
  value?: string | number | boolean | Array<string | number>;
}

export interface VisibilityRuleGroup {
  mode: 'all' | 'any';
  rules: VisibilityCondition[];
}

export interface LayoutFieldItem {
  id: string;
  kind: 'field';
  fieldKey: string;
  colSpan: number;
  helpText?: string;
  readOnly?: boolean;
  visibleWhen?: VisibilityRuleGroup;
}

export interface LayoutHeadingItem {
  id: string;
  kind: 'heading';
  text: string;
  subtitle?: string;
  colSpan: number;
  visibleWhen?: VisibilityRuleGroup;
}

export interface LayoutDividerItem {
  id: string;
  kind: 'divider';
  colSpan: number;
  visibleWhen?: VisibilityRuleGroup;
}

export interface LayoutAttachmentSlotItem {
  id: string;
  kind: 'attachmentSlot';
  slotKey: string;
  label: string;
  description?: string;
  targetSection: 'MAIN' | 'SECONDARY';
  required?: boolean;
  acceptMimeTypes?: string[];
  colSpan: number;
  visibleWhen?: VisibilityRuleGroup;
}

export type LayoutItem =
  | LayoutFieldItem
  | LayoutHeadingItem
  | LayoutDividerItem
  | LayoutAttachmentSlotItem;

export interface LayoutRow {
  id: string;
  items: LayoutItem[];
}

export interface LayoutSection {
  id: string;
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  visibleWhen?: VisibilityRuleGroup;
  rows: LayoutRow[];
}

export interface LayoutSchemaV1 {
  schemaVersion: 1;
  settings?: {
    columns?: 12;
    labelPlacement?: 'top' | 'left';
    showSectionNumbers?: boolean;
  };
  sections: LayoutSection[];
}

export type TableColumnType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';

export interface TableColumnOption {
  label: string;
  value: string;
}

export interface TableColumnDef {
  key: string;
  label: string;
  type: TableColumnType;
  width?: number;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: TableColumnOption[];
}

export interface TableAggregateRule {
  columnKey: string;
  op: 'SUM' | 'COUNT';
  targetFieldKey?: string;
}

export interface TableFieldConfig {
  columns: TableColumnDef[];
  minRows?: number;
  maxRows?: number;
  addRowLabel?: string;
  showRowNumber?: boolean;
  summary?: {
    label?: string;
    aggregates: TableAggregateRule[];
  };
}

export interface LayoutValidationDetail {
  fieldKey?: string;
  rowIndex?: number;
  columnKey?: string;
  path?: string;
  code: string;
  message: string;
}

export const VISIBILITY_OPERATORS: ReadonlySet<string> = new Set([
  'eq',
  'neq',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'empty',
  'notEmpty',
]);

export function isValueEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Evaluate a single VisibilityCondition against the current form values map. */
export function evaluateCondition(
  rule: VisibilityCondition,
  values: Record<string, unknown>,
): boolean {
  const actual = values[rule.fieldKey];

  switch (rule.op) {
    case 'empty':
      return isValueEmpty(actual);
    case 'notEmpty':
      return !isValueEmpty(actual);
    case 'eq':
      return equalsValue(actual, rule.value);
    case 'neq':
      return !equalsValue(actual, rule.value);
    case 'in':
      return matchesInList(actual, rule.value);
    case 'notIn':
      return !matchesInList(actual, rule.value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (isValueEmpty(actual)) return false;
      const a = Number(actual);
      const b = Number(rule.value);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (rule.op === 'gt') return a > b;
      if (rule.op === 'gte') return a >= b;
      if (rule.op === 'lt') return a < b;
      return a <= b;
    }
    case 'contains': {
      if (isValueEmpty(actual)) return false;
      const expected = String(rule.value ?? '');
      if (Array.isArray(actual)) {
        return actual.map(String).includes(expected);
      }
      return String(actual).toLowerCase().includes(expected.toLowerCase());
    }
    default:
      return true;
  }
}

function equalsValue(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' || typeof expected === 'number') {
    if (isValueEmpty(actual) || isValueEmpty(expected)) {
      return isValueEmpty(actual) && isValueEmpty(expected);
    }
    const a = Number(actual);
    const b = Number(expected);
    if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  }
  return String(actual ?? '') === String(expected ?? '');
}

function matchesInList(actual: unknown, expectedList: unknown): boolean {
  if (!Array.isArray(expectedList) || isValueEmpty(actual)) return false;
  const set = new Set(expectedList.map(String));
  if (Array.isArray(actual)) {
    return actual.some((item) => set.has(String(item)));
  }
  return set.has(String(actual));
}

/** Evaluate a VisibilityRuleGroup (`all` = AND, `any` = OR). */
export function evaluateVisibility(
  group: VisibilityRuleGroup | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
    return true;
  }
  return group.mode === 'any'
    ? group.rules.some((r) => evaluateCondition(r, values))
    : group.rules.every((r) => evaluateCondition(r, values));
}

/** Normalize nullable/partial layoutSchema into full LayoutSchemaV1. */
export function normalizeLayoutSchema(
  formName: string,
  fields: Array<{ key: string }>,
  layoutSchema: LayoutSchemaV1 | null | undefined,
): LayoutSchemaV1 {
  if (!layoutSchema) {
    return {
      schemaVersion: 1,
      settings: {
        columns: 12,
        labelPlacement: 'top',
        showSectionNumbers: false,
      },
      sections: [
        {
          id: 'sec_default',
          title: formName || 'Thông tin biểu mẫu',
          rows: fields.map((f, idx) => ({
            id: `row_auto_${idx}`,
            items: [
              {
                id: `item_auto_${f.key}`,
                kind: 'field',
                fieldKey: f.key,
                colSpan: 12,
              },
            ],
          })),
        },
      ],
    };
  }

  const placedKeys = new Set<string>();
  for (const sec of layoutSchema.sections) {
    for (const row of sec.rows) {
      for (const item of row.items) {
        if (item.kind === 'field') placedKeys.add(item.fieldKey);
      }
    }
  }

  const orphans = fields.filter((f) => !placedKeys.has(f.key));
  if (orphans.length === 0) return layoutSchema;

  return {
    ...layoutSchema,
    sections: [
      ...layoutSchema.sections,
      {
        id: 'sec_unassigned',
        title: 'Thông tin bổ sung',
        rows: orphans.map((f, idx) => ({
          id: `row_orphan_${idx}`,
          items: [
            {
              id: `item_orphan_${f.key}`,
              kind: 'field',
              fieldKey: f.key,
              colSpan: 12,
            },
          ],
        })),
      },
    ],
  };
}

/** Compute visible fieldKey set taking cascading section -> item rules into account. */
export function computeVisibleFieldKeys(
  fields: Array<{ key: string }>,
  layoutSchema: LayoutSchemaV1 | null | undefined,
  values: Record<string, unknown>,
): Set<string> {
  if (!layoutSchema) {
    return new Set(fields.map((f) => f.key));
  }

  const visible = new Set<string>();
  const placed = new Set<string>();

  for (const sec of layoutSchema.sections) {
    const secVisible = evaluateVisibility(sec.visibleWhen, values);
    for (const row of sec.rows) {
      for (const item of row.items) {
        if (item.kind !== 'field') continue;
        placed.add(item.fieldKey);
        if (secVisible && evaluateVisibility(item.visibleWhen, values)) {
          visible.add(item.fieldKey);
        }
      }
    }
  }

  // Unplaced/orphan fields default to visible.
  for (const f of fields) {
    if (!placed.has(f.key)) visible.add(f.key);
  }
  return visible;
}

/** Compute aggregate values for a single TABLE field. */
export function computeTableAggregateValue(
  op: 'SUM' | 'COUNT',
  columnKey: string,
  rows: Array<Record<string, unknown>>,
): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  if (op === 'COUNT') {
    return rows.reduce(
      (count, row) => count + (isValueEmpty(row?.[columnKey]) ? 0 : 1),
      0,
    );
  }
  return rows.reduce((sum, row) => {
    const raw = row?.[columnKey];
    if (isValueEmpty(raw)) return sum;
    const n = Number(raw);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
}


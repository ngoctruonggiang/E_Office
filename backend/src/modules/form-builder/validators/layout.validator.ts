import { BadRequestException } from '@nestjs/common';
import { FieldType } from '@prisma/client';
import type { FormFieldInput } from '../dto/form-field.input';
import {
  LayoutItem,
  LayoutSchemaV1,
  LayoutValidationDetail,
  TableFieldConfig,
  VISIBILITY_OPERATORS,
  VisibilityRuleGroup,
} from '../layout-schema.types';

const VALID_COLUMN_KEY = /^[a-zA-Z0-9_]+$/;
const VALID_TABLE_COL_TYPES = new Set(['TEXT', 'NUMBER', 'DATE', 'SELECT']);
const VALID_DOC_SECTIONS = new Set(['MAIN', 'SECONDARY']);
const MAX_TABLE_ROWS_LIMIT = 200;

/**
 * Validates Form fields + TableFieldConfig + LayoutSchemaV1 consistency and
 * enforces acyclic conditional visibility dependencies.
 */
export function validateFormStructure(
  fields: FormFieldInput[],
  layoutSchema: unknown,
): void {
  const errors: LayoutValidationDetail[] = [];

  // 1. Field key uniqueness & TABLE config check
  const fieldByKey = new Map<string, FormFieldInput>();
  for (const field of fields) {
    if (fieldByKey.has(field.key)) {
      errors.push({
        fieldKey: field.key,
        code: 'DUPLICATE_FIELD_KEY',
        message: `Duplicate field key "${field.key}"`,
      });
    } else {
      fieldByKey.set(field.key, field);
    }
  }

  for (const field of fields) {
    if (field.type === FieldType.TABLE) {
      validateTableConfig(field, fieldByKey, errors);
    } else if (field.tableConfig != null) {
      errors.push({
        fieldKey: field.key,
        code: 'TABLE_CONFIG_FORBIDDEN',
        message: `Field "${field.key}" has type ${field.type} and must not set tableConfig`,
      });
    }
  }

  // 2. Layout schema validation (nullable)
  if (layoutSchema !== undefined && layoutSchema !== null) {
    validateLayoutSchemaObject(layoutSchema, fieldByKey, errors);
  }

  if (errors.length > 0) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Form validation failed',
      details: errors,
    });
  }
}

function validateTableConfig(
  field: FormFieldInput,
  fieldByKey: Map<string, FormFieldInput>,
  errors: LayoutValidationDetail[],
): void {
  const cfg = field.tableConfig as TableFieldConfig | null | undefined;
  if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.columns)) {
    errors.push({
      fieldKey: field.key,
      code: 'TABLE_COLUMNS_REQUIRED',
      message: `TABLE field "${field.key}" requires tableConfig.columns`,
    });
    return;
  }

  if (cfg.columns.length === 0) {
    errors.push({
      fieldKey: field.key,
      code: 'TABLE_COLUMNS_REQUIRED',
      message: `TABLE field "${field.key}" must define at least 1 column`,
    });
  }

  const colMap = new Map<string, string>();
  for (const col of cfg.columns) {
    if (!col || typeof col !== 'object' || typeof col.key !== 'string') {
      errors.push({
        fieldKey: field.key,
        code: 'INVALID_TABLE_CONFIG',
        message: `Each column in "${field.key}" must be an object with a key`,
      });
      continue;
    }
    if (!VALID_COLUMN_KEY.test(col.key)) {
      errors.push({
        fieldKey: field.key,
        columnKey: col.key,
        code: 'INVALID_TABLE_CONFIG',
        message: `Column key "${col.key}" must match /^[a-zA-Z0-9_]+$/`,
      });
    }
    if (colMap.has(col.key)) {
      errors.push({
        fieldKey: field.key,
        columnKey: col.key,
        code: 'INVALID_TABLE_CONFIG',
        message: `Duplicate column key "${col.key}" in "${field.key}"`,
      });
    }
    if (!VALID_TABLE_COL_TYPES.has(col.type)) {
      errors.push({
        fieldKey: field.key,
        columnKey: col.key,
        code: 'INVALID_TABLE_CONFIG',
        message: `Invalid column type "${String(col.type)}"`,
      });
    } else {
      colMap.set(col.key, col.type);
    }

    if (
      col.type === 'SELECT' &&
      (!Array.isArray(col.options) || col.options.length === 0)
    ) {
      errors.push({
        fieldKey: field.key,
        columnKey: col.key,
        code: 'INVALID_TABLE_CONFIG',
        message: `SELECT column "${col.key}" requires at least 1 option`,
      });
    }
  }

  if (
    cfg.minRows !== undefined &&
    (!Number.isInteger(cfg.minRows) || cfg.minRows < 0)
  ) {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_TABLE_CONFIG',
      message: `minRows for "${field.key}" must be an integer >= 0`,
    });
  }
  if (
    cfg.maxRows !== undefined &&
    (!Number.isInteger(cfg.maxRows) ||
      cfg.maxRows < 1 ||
      cfg.maxRows > MAX_TABLE_ROWS_LIMIT)
  ) {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_TABLE_CONFIG',
      message: `maxRows for "${field.key}" must be between 1 and ${MAX_TABLE_ROWS_LIMIT}`,
    });
  }
  if (
    cfg.minRows !== undefined &&
    cfg.maxRows !== undefined &&
    cfg.minRows > cfg.maxRows
  ) {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_TABLE_CONFIG',
      message: `minRows cannot exceed maxRows in "${field.key}"`,
    });
  }

  if (cfg.summary?.aggregates) {
    if (!Array.isArray(cfg.summary.aggregates)) {
      errors.push({
        fieldKey: field.key,
        code: 'INVALID_TABLE_CONFIG',
        message: `summary.aggregates in "${field.key}" must be an array`,
      });
      return;
    }

    for (const agg of cfg.summary.aggregates) {
      const colType = colMap.get(agg.columnKey);
      if (!colType) {
        errors.push({
          fieldKey: field.key,
          columnKey: agg.columnKey,
          code: 'INVALID_TABLE_CONFIG',
          message: `Aggregate references unknown column "${agg.columnKey}"`,
        });
      } else if (agg.op === 'SUM' && colType !== 'NUMBER') {
        errors.push({
          fieldKey: field.key,
          columnKey: agg.columnKey,
          code: 'INVALID_TABLE_CONFIG',
          message: `SUM aggregate requires NUMBER column, got ${colType}`,
        });
      } else if (agg.op !== 'SUM' && agg.op !== 'COUNT') {
        errors.push({
          fieldKey: field.key,
          code: 'INVALID_TABLE_CONFIG',
          message: `Aggregate op must be SUM or COUNT`,
        });
      }

      if (agg.targetFieldKey !== undefined) {
        const target = fieldByKey.get(agg.targetFieldKey);
        if (!target || target.type !== FieldType.NUMBER) {
          errors.push({
            fieldKey: field.key,
            code: 'INVALID_AGGREGATE_TARGET',
            message: `Aggregate targetFieldKey "${agg.targetFieldKey}" must reference a NUMBER field in the same form`,
          });
        }
      }
    }
  }
}

function validateLayoutSchemaObject(
  raw: unknown,
  fieldByKey: Map<string, FormFieldInput>,
  errors: LayoutValidationDetail[],
): void {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push({
      path: 'layoutSchema',
      code: 'INVALID_LAYOUT_SCHEMA',
      message: 'layoutSchema must be an object',
    });
    return;
  }

  const schema = raw as Partial<LayoutSchemaV1>;
  if (schema.schemaVersion !== 1) {
    errors.push({
      path: 'layoutSchema.schemaVersion',
      code: 'INVALID_LAYOUT_SCHEMA',
      message: 'layoutSchema.schemaVersion must equal 1',
    });
  }
  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    errors.push({
      path: 'layoutSchema.sections',
      code: 'INVALID_LAYOUT_SCHEMA',
      message: 'layoutSchema.sections must contain at least 1 section',
    });
    return;
  }

  const seenIds = new Set<string>();
  const placedFieldKeys = new Set<string>();
  // Dependency graph: sourceFieldKey -> Set<referencedFieldKey>
  const deps = new Map<string, Set<string>>();

  // Include TABLE summary targetFieldKey -> tableField.key dependencies
  for (const field of fieldByKey.values()) {
    if (field.type === FieldType.TABLE && field.tableConfig) {
      const cfg = field.tableConfig as TableFieldConfig;
      for (const agg of cfg.summary?.aggregates ?? []) {
        if (agg.targetFieldKey) {
          if (!deps.has(agg.targetFieldKey)) {
            deps.set(agg.targetFieldKey, new Set());
          }
          deps.get(agg.targetFieldKey)!.add(field.key);
        }
      }
    }
  }

  const registerId = (id: unknown, path: string) => {
    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push({
        path,
        code: 'INVALID_LAYOUT_SCHEMA',
        message: `${path}.id must be a non-empty string`,
      });
      return;
    }
    if (seenIds.has(id)) {
      errors.push({
        path,
        code: 'DUPLICATE_LAYOUT_ID',
        message: `Duplicate layout element id "${id}"`,
      });
    }
    seenIds.add(id);
  };

  for (let sIdx = 0; sIdx < schema.sections.length; sIdx++) {
    const sec = schema.sections[sIdx];
    const secPath = `sections[${sIdx}]`;
    registerId(sec?.id, secPath);

    if (typeof sec?.title !== 'string' || sec.title.trim().length === 0) {
      errors.push({
        path: `${secPath}.title`,
        code: 'INVALID_LAYOUT_SCHEMA',
        message: `Section title is required`,
      });
    }

    const secConditionKeys = validateVisibilityGroup(
      sec?.visibleWhen,
      `${secPath}.visibleWhen`,
      fieldByKey,
      errors,
    );

    if (!Array.isArray(sec?.rows)) {
      errors.push({
        path: `${secPath}.rows`,
        code: 'INVALID_LAYOUT_SCHEMA',
        message: `Section "${sec?.id ?? sIdx}" rows must be an array`,
      });
      continue;
    }

    for (let rIdx = 0; rIdx < sec.rows.length; rIdx++) {
      const row = sec.rows[rIdx];
      const rowPath = `${secPath}.rows[${rIdx}]`;
      registerId(row?.id, rowPath);

      if (!Array.isArray(row?.items) || row.items.length === 0) {
        errors.push({
          path: `${rowPath}.items`,
          code: 'INVALID_LAYOUT_SCHEMA',
          message: `Row "${row?.id ?? rIdx}" must contain at least 1 item`,
        });
        continue;
      }

      let colSpanSum = 0;
      for (let iIdx = 0; iIdx < row.items.length; iIdx++) {
        const item = row.items[iIdx];
        const itemPath = `${rowPath}.items[${iIdx}]`;
        registerId(item?.id, itemPath);

        if (
          typeof item?.colSpan !== 'number' ||
          !Number.isInteger(item.colSpan) ||
          item.colSpan < 1 ||
          item.colSpan > 12
        ) {
          errors.push({
            path: `${itemPath}.colSpan`,
            code: 'ROW_COLSPAN_EXCEEDED',
            message: `colSpan must be an integer between 1 and 12`,
          });
        } else {
          colSpanSum += item.colSpan;
        }

        const itemConditionKeys = validateVisibilityGroup(
          item?.visibleWhen,
          `${itemPath}.visibleWhen`,
          fieldByKey,
          errors,
        );

        validateLayoutItemKind(
          item,
          itemPath,
          fieldByKey,
          placedFieldKeys,
          errors,
        );

        if (item?.kind === 'field' && typeof item.fieldKey === 'string') {
          if (!deps.has(item.fieldKey)) deps.set(item.fieldKey, new Set());
          const set = deps.get(item.fieldKey)!;
          for (const k of secConditionKeys) set.add(k);
          for (const k of itemConditionKeys) set.add(k);
        }
      }

      if (colSpanSum > 12) {
        errors.push({
          path: rowPath,
          code: 'ROW_COLSPAN_EXCEEDED',
          message: `Row "${row.id}" total colSpan is ${colSpanSum}, exceeding 12 columns`,
        });
      }
    }
  }

  detectVisibilityCycles(deps, errors);
}

function validateLayoutItemKind(
  item: LayoutItem,
  itemPath: string,
  fieldByKey: Map<string, FormFieldInput>,
  placedFieldKeys: Set<string>,
  errors: LayoutValidationDetail[],
): void {
  if (!item || typeof item !== 'object') return;

  switch (item.kind) {
    case 'field': {
      if (typeof item.fieldKey !== 'string' || !fieldByKey.has(item.fieldKey)) {
        errors.push({
          fieldKey: item.fieldKey,
          path: itemPath,
          code: 'UNKNOWN_LAYOUT_FIELD',
          message: `Layout references unknown fieldKey "${String(item.fieldKey)}"`,
        });
      } else if (placedFieldKeys.has(item.fieldKey)) {
        errors.push({
          fieldKey: item.fieldKey,
          path: itemPath,
          code: 'DUPLICATE_LAYOUT_FIELD',
          message: `Field "${item.fieldKey}" appears more than once in layoutSchema`,
        });
      } else {
        placedFieldKeys.add(item.fieldKey);
      }
      break;
    }
    case 'heading': {
      if (typeof item.text !== 'string' || item.text.trim().length === 0) {
        errors.push({
          path: `${itemPath}.text`,
          code: 'INVALID_LAYOUT_SCHEMA',
          message: 'Heading text is required',
        });
      }
      break;
    }
    case 'divider':
      break;
    case 'attachmentSlot': {
      if (typeof item.slotKey !== 'string' || !item.slotKey.trim()) {
        errors.push({
          path: `${itemPath}.slotKey`,
          code: 'INVALID_LAYOUT_SCHEMA',
          message: 'attachmentSlot.slotKey is required',
        });
      }
      if (typeof item.label !== 'string' || !item.label.trim()) {
        errors.push({
          path: `${itemPath}.label`,
          code: 'INVALID_LAYOUT_SCHEMA',
          message: 'attachmentSlot.label is required',
        });
      }
      if (!VALID_DOC_SECTIONS.has(item.targetSection)) {
        errors.push({
          path: `${itemPath}.targetSection`,
          code: 'INVALID_LAYOUT_SCHEMA',
          message: 'attachmentSlot.targetSection must be MAIN or SECONDARY',
        });
      }
      break;
    }
    default: {
      errors.push({
        path: `${itemPath}.kind`,
        code: 'INVALID_LAYOUT_SCHEMA',
        message: `Unknown layout item kind "${String((item as { kind?: unknown }).kind)}"`,
      });
    }
  }
}

function validateVisibilityGroup(
  group: VisibilityRuleGroup | undefined,
  path: string,
  fieldByKey: Map<string, FormFieldInput>,
  errors: LayoutValidationDetail[],
): string[] {
  if (group === undefined || group === null) return [];
  if (typeof group !== 'object' || !Array.isArray(group.rules)) {
    errors.push({
      path,
      code: 'INVALID_LAYOUT_SCHEMA',
      message: `${path} must have mode and rules array`,
    });
    return [];
  }
  if (group.mode !== 'all' && group.mode !== 'any') {
    errors.push({
      path: `${path}.mode`,
      code: 'INVALID_LAYOUT_SCHEMA',
      message: `${path}.mode must be "all" or "any"`,
    });
  }
  if (group.rules.length === 0) {
    errors.push({
      path: `${path}.rules`,
      code: 'INVALID_LAYOUT_SCHEMA',
      message: `${path}.rules must contain at least 1 condition`,
    });
    return [];
  }

  const referenced: string[] = [];
  for (let i = 0; i < group.rules.length; i++) {
    const rule = group.rules[i];
    if (!rule || typeof rule.fieldKey !== 'string' || !fieldByKey.has(rule.fieldKey)) {
      errors.push({
        fieldKey: rule?.fieldKey,
        path: `${path}.rules[${i}].fieldKey`,
        code: 'UNKNOWN_VISIBILITY_FIELD',
        message: `Visibility rule references unknown fieldKey "${String(rule?.fieldKey)}"`,
      });
    } else {
      referenced.push(rule.fieldKey);
    }
    if (!VISIBILITY_OPERATORS.has(rule?.op)) {
      errors.push({
        path: `${path}.rules[${i}].op`,
        code: 'INVALID_LAYOUT_SCHEMA',
        message: `Unsupported visibility operator "${String(rule?.op)}"`,
      });
    }
  }
  return referenced;
}

function detectVisibilityCycles(
  deps: Map<string, Set<string>>,
  errors: LayoutValidationDetail[],
): void {
  // 0 = unvisited, 1 = visiting (on stack), 2 = visited
  const state = new Map<string, number>();

  const dfs = (node: string): boolean => {
    state.set(node, 1);
    for (const next of deps.get(node) ?? []) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 1) {
        errors.push({
          fieldKey: node,
          code: 'LAYOUT_VISIBILITY_CYCLE',
          message: `Circular visibility/aggregate dependency involving "${node}" -> "${next}"`,
        });
        return true;
      }
      if (nextState === 0 && dfs(next)) return true;
    }
    state.set(node, 2);
    return false;
  };

  for (const key of deps.keys()) {
    if ((state.get(key) ?? 0) === 0) {
      dfs(key);
    }
  }
}


import { BadRequestException } from '@nestjs/common';
import { FieldType, SelectMode, ValidationType } from '@prisma/client';
import {
  LayoutSchemaV1,
  LayoutValidationDetail,
  TableColumnDef,
  TableFieldConfig,
  computeTableAggregateValue,
  computeVisibleFieldKeys,
  isValueEmpty,
} from '../layout-schema.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{6,}$/;

export interface ValidatableFormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  selectMode: SelectMode | null;
  tableConfig: unknown;
  options: Array<{ value: string }>;
  validations: Array<{ type: ValidationType; regex: string | null }>;
}

export interface RequestValueEntry {
  fieldKey: string;
  value: unknown;
}

export interface ValidatedValuesResult {
  sanitizedEntries: RequestValueEntry[];
  hiddenFieldKeys: Set<string>;
}

/**
 * Validates request EAV values against a FormVersion's fields & layoutSchema.
 * - Recomputes visible TABLE summary aggregates into targetFieldKey fields.
 * - Evaluates visibleWhen rules (2-pass fixpoint) so hidden fields bypass
 *   required/format checks and are excluded from persisted entries on submit.
 */
export function validateRequestValues(params: {
  fields: ValidatableFormField[];
  layoutSchema: unknown;
  entries: RequestValueEntry[];
  mode: 'strict' | 'draft';
}): ValidatedValuesResult {
  const { fields, entries, mode } = params;
  const layoutSchema = (params.layoutSchema ?? null) as LayoutSchemaV1 | null;

  const workingMap: Record<string, unknown> = {};
  for (const entry of entries) {
    workingMap[entry.fieldKey] = entry.value;
  }

  // Pass 1: initial visibility + recompute TABLE aggregates into target fields
  const pass1Visible = computeVisibleFieldKeys(fields, layoutSchema, workingMap);
  const recomputedTargets = new Set<string>();

  for (const field of fields) {
    if (field.type !== FieldType.TABLE || !pass1Visible.has(field.key)) continue;
    const cfg = field.tableConfig as TableFieldConfig | null;
    const rawRows = workingMap[field.key];
    if (!cfg?.summary?.aggregates?.length || !Array.isArray(rawRows)) continue;

    for (const agg of cfg.summary.aggregates) {
      if (!agg.targetFieldKey) continue;
      workingMap[agg.targetFieldKey] = computeTableAggregateValue(
        agg.op,
        agg.columnKey,
        rawRows as Array<Record<string, unknown>>,
      );
      recomputedTargets.add(agg.targetFieldKey);
    }
  }

  // Pass 2: final visibility using recomputed aggregate targets
  const visibleKeys = computeVisibleFieldKeys(fields, layoutSchema, workingMap);
  const hiddenFieldKeys = new Set<string>(
    fields.filter((f) => !visibleKeys.has(f.key)).map((f) => f.key),
  );

  // If a recomputed target field ended up hidden, drop its recomputed key
  for (const targetKey of recomputedTargets) {
    if (!visibleKeys.has(targetKey)) {
      delete workingMap[targetKey];
    }
  }

  const errors: LayoutValidationDetail[] = [];

  for (const field of fields) {
    if (!visibleKeys.has(field.key)) continue;
    const value = workingMap[field.key];
    const hasValue = !isValueEmpty(value);

    if (mode === 'strict' && field.required && !hasValue) {
      errors.push({
        fieldKey: field.key,
        code: 'REQUIRED',
        message: `${field.label} is required`,
      });
      continue;
    }

    if (!hasValue) {
      // Allow empty optional fields (or empty draft fields)
      continue;
    }

    validateSingleFieldValue(field, value, mode, errors);
  }

  if (errors.length > 0) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Form validation failed',
      details: errors,
    });
  }

  const sanitizedEntries: RequestValueEntry[] = [];
  const emitted = new Set<string>();

  // Preserve supplied order; in strict mode strip hidden fields, in draft keep them until submit
  for (const entry of entries) {
    if (mode === 'strict' && hiddenFieldKeys.has(entry.fieldKey)) continue;
    if (emitted.has(entry.fieldKey)) continue;
    emitted.add(entry.fieldKey);
    sanitizedEntries.push({
      fieldKey: entry.fieldKey,
      value: workingMap[entry.fieldKey],
    });
  }
  // Ensure any newly recomputed visible targetFieldKey not originally in payload is emitted
  for (const targetKey of recomputedTargets) {
    if (!hiddenFieldKeys.has(targetKey) && !emitted.has(targetKey)) {
      emitted.add(targetKey);
      sanitizedEntries.push({
        fieldKey: targetKey,
        value: workingMap[targetKey],
      });
    }
  }

  return { sanitizedEntries, hiddenFieldKeys };
}

function validateSingleFieldValue(
  field: ValidatableFormField,
  value: unknown,
  mode: 'strict' | 'draft',
  errors: LayoutValidationDetail[],
): void {
  switch (field.type) {
    case FieldType.TEXT:
      validateTextValue(field, value, errors);
      break;
    case FieldType.NUMBER:
      validateNumberValue(field, value, errors);
      break;
    case FieldType.DATE:
      validateDateValue(field.key, field.label, value, errors);
      break;
    case FieldType.SELECT:
      validateSelectValue(field, value, errors);
      break;
    case FieldType.TABLE:
      validateTableValue(field, value, mode, errors);
      break;
  }
}

function validateTextValue(
  field: ValidatableFormField,
  value: unknown,
  errors: LayoutValidationDetail[],
): void {
  if (typeof value !== 'string') {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_TYPE',
      message: `${field.label} must be a string`,
    });
    return;
  }
  const maxLen = field.maxLength ?? 250;
  if (value.length > maxLen) {
    errors.push({
      fieldKey: field.key,
      code: 'MAX_LENGTH',
      message: `${field.label} must be at most ${maxLen} characters`,
    });
  }
  for (const rule of field.validations) {
    if (rule.type === ValidationType.EMAIL && !EMAIL_RE.test(value)) {
      errors.push({
        fieldKey: field.key,
        code: 'INVALID_FORMAT',
        message: `${field.label} must be a valid email`,
      });
    } else if (rule.type === ValidationType.PHONE && !PHONE_RE.test(value)) {
      errors.push({
        fieldKey: field.key,
        code: 'INVALID_FORMAT',
        message: `${field.label} must be a valid phone number`,
      });
    } else if (rule.type === ValidationType.REGEX && rule.regex) {
      try {
        if (!new RegExp(rule.regex).test(value)) {
          errors.push({
            fieldKey: field.key,
            code: 'INVALID_FORMAT',
            message: `${field.label} is invalid`,
          });
        }
      } catch {
        // Ignore malformed admin regex safely.
      }
    }
  }
}

function validateNumberValue(
  field: ValidatableFormField,
  value: unknown,
  errors: LayoutValidationDetail[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_TYPE',
      message: `${field.label} must be a finite number`,
    });
    return;
  }
  if (field.min !== null && value < field.min) {
    errors.push({
      fieldKey: field.key,
      code: 'MIN_VALUE',
      message: `${field.label} must be >= ${field.min}`,
    });
  }
  if (field.max !== null && value > field.max) {
    errors.push({
      fieldKey: field.key,
      code: 'MAX_VALUE',
      message: `${field.label} must be <= ${field.max}`,
    });
  }
}

function validateDateValue(
  fieldKey: string,
  label: string,
  value: unknown,
  errors: LayoutValidationDetail[],
  rowIndex?: number,
  columnKey?: string,
): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    errors.push({
      fieldKey,
      ...(rowIndex !== undefined ? { rowIndex } : {}),
      ...(columnKey !== undefined ? { columnKey } : {}),
      code: 'INVALID_FORMAT',
      message: `${label} must be a valid date`,
    });
  }
}

function validateSelectValue(
  field: ValidatableFormField,
  value: unknown,
  errors: LayoutValidationDetail[],
): void {
  const allowed = new Set(field.options.map((o) => o.value));
  if (field.selectMode === SelectMode.MULTIPLE) {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
      errors.push({
        fieldKey: field.key,
        code: 'INVALID_TYPE',
        message: `${field.label} must be an array of option values`,
      });
      return;
    }
    if (allowed.size > 0 && value.some((v) => !allowed.has(v))) {
      errors.push({
        fieldKey: field.key,
        code: 'INVALID_OPTION',
        message: `${field.label} contains an invalid selection`,
      });
    }
    return;
  }

  if (typeof value !== 'string') {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_TYPE',
      message: `${field.label} must be a string option value`,
    });
    return;
  }
  if (allowed.size > 0 && !allowed.has(value)) {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_OPTION',
      message: `${field.label} has an invalid selection`,
    });
  }
}

function validateTableValue(
  field: ValidatableFormField,
  value: unknown,
  mode: 'strict' | 'draft',
  errors: LayoutValidationDetail[],
): void {
  if (!Array.isArray(value)) {
    errors.push({
      fieldKey: field.key,
      code: 'INVALID_TYPE',
      message: `${field.label} must be an array of rows`,
    });
    return;
  }

  const cfg = field.tableConfig as TableFieldConfig | null;
  if (!cfg || !Array.isArray(cfg.columns)) return;

  const minRows = cfg.minRows ?? (field.required ? 1 : 0);
  const maxRows = cfg.maxRows ?? 50;

  if (mode === 'strict' && value.length < minRows) {
    errors.push({
      fieldKey: field.key,
      code: 'TABLE_ROW_COUNT',
      message: `${field.label} requires at least ${minRows} row(s)`,
    });
  }
  if (value.length > maxRows) {
    errors.push({
      fieldKey: field.key,
      code: 'TABLE_ROW_COUNT',
      message: `${field.label} allows at most ${maxRows} row(s)`,
    });
  }

  for (let rIdx = 0; rIdx < value.length; rIdx++) {
    const row = value[rIdx];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      errors.push({
        fieldKey: field.key,
        rowIndex: rIdx,
        code: 'INVALID_TYPE',
        message: `Row ${rIdx + 1} in ${field.label} must be an object`,
      });
      continue;
    }

    const rowObj = row as Record<string, unknown>;
    for (const col of cfg.columns) {
      validateTableCell(field.key, rIdx, col, rowObj[col.key], mode, errors);
    }
  }
}

function validateTableCell(
  fieldKey: string,
  rowIndex: number,
  col: TableColumnDef,
  cellVal: unknown,
  mode: 'strict' | 'draft',
  errors: LayoutValidationDetail[],
): void {
  const empty = isValueEmpty(cellVal);
  if (mode === 'strict' && col.required && empty) {
    errors.push({
      fieldKey,
      rowIndex,
      columnKey: col.key,
      code: 'REQUIRED',
      message: `${col.label} is required`,
    });
    return;
  }
  if (empty) return;

  switch (col.type) {
    case 'TEXT': {
      if (typeof cellVal !== 'string') {
        errors.push({
          fieldKey,
          rowIndex,
          columnKey: col.key,
          code: 'INVALID_TYPE',
          message: `${col.label} must be a string`,
        });
        return;
      }
      const maxLen = col.maxLength ?? 250;
      if (cellVal.length > maxLen) {
        errors.push({
          fieldKey,
          rowIndex,
          columnKey: col.key,
          code: 'MAX_LENGTH',
          message: `${col.label} must be at most ${maxLen} characters`,
        });
      }
      break;
    }
    case 'NUMBER': {
      if (typeof cellVal !== 'number' || !Number.isFinite(cellVal)) {
        errors.push({
          fieldKey,
          rowIndex,
          columnKey: col.key,
          code: 'INVALID_TYPE',
          message: `${col.label} must be a finite number`,
        });
        return;
      }
      if (col.min !== undefined && cellVal < col.min) {
        errors.push({
          fieldKey,
          rowIndex,
          columnKey: col.key,
          code: 'MIN_VALUE',
          message: `${col.label} must be >= ${col.min}`,
        });
      }
      if (col.max !== undefined && cellVal > col.max) {
        errors.push({
          fieldKey,
          rowIndex,
          columnKey: col.key,
          code: 'MAX_VALUE',
          message: `${col.label} must be <= ${col.max}`,
        });
      }
      break;
    }
    case 'DATE':
      validateDateValue(fieldKey, col.label, cellVal, errors, rowIndex, col.key);
      break;
    case 'SELECT': {
      const allowed = new Set((col.options ?? []).map((o) => o.value));
      if (typeof cellVal !== 'string' || (allowed.size > 0 && !allowed.has(cellVal))) {
        errors.push({
          fieldKey,
          rowIndex,
          columnKey: col.key,
          code: 'INVALID_OPTION',
          message: `${col.label} has an invalid selection`,
        });
      }
      break;
    }
  }
}

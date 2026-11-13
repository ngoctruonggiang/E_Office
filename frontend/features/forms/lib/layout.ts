import type {
  FormFieldView,
  FormValues,
  LayoutSchemaV1,
  TableFieldConfig,
  VisibilityCondition,
  VisibilityRuleGroup,
} from "../types/form";

export function isValueEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function equalsValue(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "number" || typeof expected === "number") {
    if (isValueEmpty(actual) || isValueEmpty(expected)) {
      return isValueEmpty(actual) && isValueEmpty(expected);
    }
    const a = Number(actual);
    const b = Number(expected);
    if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  }
  return String(actual ?? "") === String(expected ?? "");
}

function matchesInList(actual: unknown, expectedList: unknown): boolean {
  if (!Array.isArray(expectedList) || isValueEmpty(actual)) return false;
  const set = new Set(expectedList.map(String));
  if (Array.isArray(actual)) {
    return actual.some((item) => set.has(String(item)));
  }
  return set.has(String(actual));
}

export function evaluateCondition(
  rule: VisibilityCondition,
  values: FormValues,
): boolean {
  const actual = values[rule.fieldKey];

  switch (rule.op) {
    case "empty":
      return isValueEmpty(actual);
    case "notEmpty":
      return !isValueEmpty(actual);
    case "eq":
      return equalsValue(actual, rule.value);
    case "neq":
      return !equalsValue(actual, rule.value);
    case "in":
      return matchesInList(actual, rule.value);
    case "notIn":
      return !matchesInList(actual, rule.value);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (isValueEmpty(actual)) return false;
      const a = Number(actual);
      const b = Number(rule.value);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (rule.op === "gt") return a > b;
      if (rule.op === "gte") return a >= b;
      if (rule.op === "lt") return a < b;
      return a <= b;
    }
    case "contains": {
      if (isValueEmpty(actual)) return false;
      const expected = String(rule.value ?? "");
      if (Array.isArray(actual)) {
        return actual.map(String).includes(expected);
      }
      return String(actual).toLowerCase().includes(expected.toLowerCase());
    }
    default:
      return true;
  }
}

export function evaluateVisibility(
  group: VisibilityRuleGroup | null | undefined,
  values: FormValues,
): boolean {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
    return true;
  }
  return group.mode === "any"
    ? group.rules.some((r) => evaluateCondition(r, values))
    : group.rules.every((r) => evaluateCondition(r, values));
}

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
        labelPlacement: "top",
        showSectionNumbers: false,
      },
      sections: [
        {
          id: "sec_default",
          title: formName || "Thông tin biểu mẫu",
          rows: fields.map((f, idx) => ({
            id: `row_auto_${idx}`,
            items: [
              {
                id: `item_auto_${f.key}`,
                kind: "field",
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
        if (item.kind === "field") placedKeys.add(item.fieldKey);
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
        id: "sec_unassigned",
        title: "Thông tin bổ sung",
        rows: orphans.map((f, idx) => ({
          id: `row_orphan_${idx}`,
          items: [
            {
              id: `item_orphan_${f.key}`,
              kind: "field",
              fieldKey: f.key,
              colSpan: 12,
            },
          ],
        })),
      },
    ],
  };
}

export function computeVisibleFieldKeys(
  fields: Array<{ key: string }>,
  layoutSchema: LayoutSchemaV1 | null | undefined,
  values: FormValues,
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
        if (item.kind !== "field") continue;
        placed.add(item.fieldKey);
        if (secVisible && evaluateVisibility(item.visibleWhen, values)) {
          visible.add(item.fieldKey);
        }
      }
    }
  }

  for (const f of fields) {
    if (!placed.has(f.key)) visible.add(f.key);
  }
  return visible;
}

export function computeTableAggregateValue(
  op: "SUM" | "COUNT",
  columnKey: string,
  rows: Array<Record<string, unknown>>,
): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  if (op === "COUNT") {
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

/** Field keys controlled automatically by a TABLE aggregate rule. */
export function getAggregateTargetFieldKeys(
  fields: Pick<FormFieldView, "type" | "tableConfig">[],
): Set<string> {
  const targets = new Set<string>();
  for (const field of fields) {
    if (field.type !== "TABLE" || !field.tableConfig?.summary?.aggregates) continue;
    for (const agg of field.tableConfig.summary.aggregates) {
      if (agg.targetFieldKey) targets.add(agg.targetFieldKey);
    }
  }
  return targets;
}

/** Synchronize any TABLE aggregate target fields into a cloned FormValues object. */
export function applyTableAggregates(
  fields: Pick<FormFieldView, "key" | "type" | "tableConfig">[],
  values: FormValues,
): FormValues {
  let next = values;
  for (const field of fields) {
    if (field.type !== "TABLE") continue;
    const cfg: TableFieldConfig | null = field.tableConfig ?? null;
    if (!cfg?.summary?.aggregates?.length) continue;
    const rows = Array.isArray(next[field.key])
      ? (next[field.key] as Array<Record<string, unknown>>)
      : [];
    for (const agg of cfg.summary.aggregates) {
      if (!agg.targetFieldKey) continue;
      const computed = computeTableAggregateValue(agg.op, agg.columnKey, rows);
      if (next[agg.targetFieldKey] !== computed) {
        if (next === values) next = { ...values };
        next[agg.targetFieldKey] = computed;
      }
    }
  }
  return next;
}

/** Detect if adding sourceKey -> candidateTargetKey creates a cycle in visibleWhen/aggregate graph. */
export function wouldCreateVisibilityCycle(
  layout: Pick<LayoutSchemaV1, "sections">,
  fields: Array<{ key: string; type: string; tableConfig?: TableFieldConfig | null }>,
  sourceKey: string,
  candidateTargetKey: string,
): boolean {
  if (!sourceKey || !candidateTargetKey) return false;
  if (sourceKey === candidateTargetKey) return true;

  const deps = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    if (!deps.has(from)) deps.set(from, new Set());
    deps.get(from)!.add(to);
  };

  for (const f of fields) {
    if (f.type === "TABLE" && f.tableConfig?.summary?.aggregates) {
      for (const agg of f.tableConfig.summary.aggregates) {
        if (agg.targetFieldKey) addEdge(agg.targetFieldKey, f.key);
      }
    }
  }

  for (const sec of layout.sections) {
    const secTargets = sec.visibleWhen?.rules.map((r) => r.fieldKey) ?? [];
    for (const row of sec.rows) {
      for (const item of row.items) {
        if (item.kind !== "field") continue;
        for (const t of secTargets) addEdge(item.fieldKey, t);
        for (const r of item.visibleWhen?.rules ?? []) {
          addEdge(item.fieldKey, r.fieldKey);
        }
      }
    }
  }

  addEdge(sourceKey, candidateTargetKey);

  // Check if sourceKey is reachable from candidateTargetKey
  const visited = new Set<string>();
  const stack = [candidateTargetKey];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === sourceKey) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of deps.get(cur) ?? []) {
      stack.push(next);
    }
  }
  return false;
}


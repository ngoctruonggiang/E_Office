"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type {
  LayoutSection,
  VisibilityCondition,
  VisibilityOperator,
  VisibilityRuleGroup,
} from "../../types/form";
import type { FieldDraft } from "../../types/builder";
import { wouldCreateVisibilityCycle } from "../../lib/layout";

const OPERATORS: Array<{ op: VisibilityOperator; label: string; needsValue: boolean }> = [
  { op: "eq", label: "Bằng (=)", needsValue: true },
  { op: "neq", label: "Khác (!=)", needsValue: true },
  { op: "gte", label: "Lớn hơn / bằng (>=)", needsValue: true },
  { op: "gt", label: "Lớn hơn (>)", needsValue: true },
  { op: "lte", label: "Nhỏ hơn / bằng (<=)", needsValue: true },
  { op: "lt", label: "Nhỏ hơn (<)", needsValue: true },
  { op: "contains", label: "Chứa chuỗi / giá trị", needsValue: true },
  { op: "in", label: "Nằm trong (a,b,c)", needsValue: true },
  { op: "notIn", label: "Không nằm trong (a,b,c)", needsValue: true },
  { op: "notEmpty", label: "Không rỗng", needsValue: false },
  { op: "empty", label: "Đang rỗng", needsValue: false },
];

export function VisibilityRuleEditor({
  value,
  onChange,
  fields,
  sections,
  currentFieldKey,
}: {
  value: VisibilityRuleGroup | undefined;
  onChange: (next: VisibilityRuleGroup | undefined) => void;
  fields: FieldDraft[];
  sections: LayoutSection[];
  /** Pass when editing a field item so self & cyclic targets are filtered out. */
  currentFieldKey?: string;
}) {
  const t = useT();

  const availableFields = fields.filter((f) => {
    if (!f.key.trim()) return false;
    if (f.type === "TABLE") return false;
    if (currentFieldKey) {
      if (f.key === currentFieldKey) return false;
      if (
        wouldCreateVisibilityCycle(
          { sections },
          fields,
          currentFieldKey,
          f.key,
        )
      ) {
        return false;
      }
    }
    return true;
  });

  const addRule = () => {
    const firstKey = availableFields[0]?.key ?? "";
    if (!firstKey) return;
    const nextRule: VisibilityCondition = {
      fieldKey: firstKey,
      op: "eq",
      value: "",
    };
    if (!value) {
      onChange({ mode: "all", rules: [nextRule] });
    } else {
      onChange({ ...value, rules: [...value.rules, nextRule] });
    }
  };

  const updateRule = (idx: number, patch: Partial<VisibilityCondition>) => {
    if (!value) return;
    const rules = value.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange({ ...value, rules });
  };

  const removeRule = (idx: number) => {
    if (!value) return;
    const rules = value.rules.filter((_, i) => i !== idx);
    onChange(rules.length > 0 ? { ...value, rules } : undefined);
  };

  return (
    <div className="space-y-2.5 border-t border-border-subtle pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {t("formBuilder.visibilityTitle")}
        </p>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11px] text-muted-foreground hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {value && (
        <div className="space-y-2">
          <Select
            value={value.mode}
            onChange={(e) =>
              onChange({ ...value, mode: e.target.value as "all" | "any" })
            }
            className="h-8 text-xs"
          >
            <option value="all">{t("formBuilder.visibilityAll")}</option>
            <option value="any">{t("formBuilder.visibilityAny")}</option>
          </Select>

          {value.rules.map((rule, idx) => {
            const opMeta = OPERATORS.find((o) => o.op === rule.op);
            const targetField = fields.find((f) => f.key === rule.fieldKey);
            const isListOp = rule.op === "in" || rule.op === "notIn";

            return (
              <div
                key={idx}
                className="space-y-1.5 rounded-md border border-border bg-surface-secondary/40 p-2"
              >
                <div className="flex items-center gap-1.5">
                  <Select
                    value={rule.fieldKey}
                    onChange={(e) => updateRule(idx, { fieldKey: e.target.value })}
                    className="h-8 flex-1 text-xs"
                  >
                    {availableFields.map((f) => (
                      <option key={f.uid} value={f.key}>
                        {f.label.trim() || f.key} ({f.key})
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-surface-secondary hover:text-danger"
                  >
                    <X size={14} />
                  </button>
                </div>

                <Select
                  value={rule.op}
                  onChange={(e) => {
                    const nextOp = e.target.value as VisibilityOperator;
                    const needs = OPERATORS.find((o) => o.op === nextOp)?.needsValue;
                    updateRule(idx, {
                      op: nextOp,
                      value: needs ? (rule.value ?? "") : undefined,
                    });
                  }}
                  className="h-8 text-xs"
                >
                  {OPERATORS.map((o) => (
                    <option key={o.op} value={o.op}>
                      {o.label}
                    </option>
                  ))}
                </Select>

                {opMeta?.needsValue &&
                  (targetField?.type === "SELECT" && !isListOp ? (
                    <Select
                      value={String(rule.value ?? "")}
                      onChange={(e) => updateRule(idx, { value: e.target.value })}
                      className="h-8 text-xs"
                    >
                      <option value="">—</option>
                      {targetField.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} ({opt.value})
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={
                        Array.isArray(rule.value)
                          ? rule.value.join(",")
                          : String(rule.value ?? "")
                      }
                      type={
                        !isListOp && targetField?.type === "NUMBER"
                          ? "number"
                          : "text"
                      }
                      placeholder={isListOp ? "val1,val2" : "Giá trị so sánh"}
                      className="h-8 text-xs"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (isListOp) {
                          updateRule(idx, {
                            value: raw
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          });
                        } else if (targetField?.type === "NUMBER") {
                          updateRule(idx, {
                            value: raw === "" ? "" : Number(raw),
                          });
                        } else {
                          updateRule(idx, { value: raw });
                        }
                      }}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={availableFields.length === 0}
        onClick={addRule}
      >
        <Plus size={13} />
        {t("formBuilder.addCondition")}
      </Button>
    </div>
  );
}


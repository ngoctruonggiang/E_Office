"use client";

import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { FormRenderer } from "@/features/forms/components/FormRenderer";
import { useFormDefinition } from "@/features/forms/hooks/useFormDefinition";
import { fromRequestValues } from "@/features/forms/lib/values";
import type {
  FormFieldView,
  RequestValue,
} from "@/features/forms/types/form";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/utils/format";
import { updateRequest } from "../api/requests";
import type { RequestValueView } from "../types/detail";

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

function useValueFormatter() {
  const [locale] = useLocale();
  const t = useT();

  return (field: FormFieldView | undefined, value: unknown): string => {
    if (isEmpty(value)) return t("detail.noValue");
    if (field?.type === "SELECT") {
      const labelOf = (val: string) =>
        field.options.find((o) => o.value === val)?.label ?? val;
      return Array.isArray(value)
        ? value.map((v) => labelOf(String(v))).join(", ")
        : labelOf(String(value));
    }
    if (field?.type === "DATE") return formatDate(String(value), locale);
    if (Array.isArray(value)) return value.map(String).join(", ");
    return String(value);
  };
}

/**
 * A request's submitted values, labelled by the form. Read-only unless
 * `editing` (controlled by the parent's top action bar), when the creator can
 * edit + save the values in place (PATCH).
 */
export function RequestFormData({
  requestId,
  formId,
  values,
  editing = false,
  onEditingChange,
  onSaved,
}: {
  requestId: string;
  formId: string;
  values: RequestValueView[];
  /** Whether the form is in edit mode (driven from the top action bar). */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useT();
  const { form, loading } = useFormDefinition(formId);
  const format = useValueFormatter();
  const { notify } = useNotifications();

  const save = async (next: RequestValue[]) => {
    try {
      await updateRequest(requestId, next);
      notify({ title: t("toast.saved"), kind: "success" });
      onEditingChange?.(false);
      onSaved?.();
    } catch (err) {
      notify({
        title: t("toast.actionFailed"),
        message:
          err instanceof ApiError || err instanceof Error ? err.message : "",
        kind: "error",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  // Edit mode: render the generic form engine pre-filled with current values.
  if (editing && form) {
    return (
      <div className="space-y-4">
        <FormRenderer
          form={form}
          initialValues={fromRequestValues(
            values.map((v) => ({ fieldKey: v.fieldKey, value: v.value })),
          )}
          submitLabel={t("common.save")}
          onSubmit={(next) => save(next)}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditingChange?.(false)}
        >
          {t("common.cancel")}
        </Button>
      </div>
    );
  }

  const byKey = new Map(values.map((v) => [v.fieldKey, v.value]));

  // Prefer the form's field order; fall back to whatever values exist.
  const rows: { key: string; field?: FormFieldView }[] = form
    ? form.fields.map((f) => ({ key: f.key, field: f }))
    : values.map((v) => ({ key: v.fieldKey }));

  // Include any stray values not present in the (latest) form definition.
  if (form) {
    for (const v of values) {
      if (!form.fields.some((f) => f.key === v.fieldKey)) {
        rows.push({ key: v.fieldKey });
      }
    }
  }

  return (
    <div className="space-y-3">
      <dl className="divide-y divide-border">
        {rows.map(({ key, field }) => (
          <div
            key={key}
            className="grid grid-cols-3 gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="text-sm text-muted-foreground">
              {field?.label ?? key}
            </dt>
            <dd className="col-span-2 text-sm text-foreground">
              {format(field, byKey.get(key))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormRenderer, colSpanClass } from "@/features/forms/components/FormRenderer";
import { TableFieldRenderer } from "@/features/forms/components/TableFieldRenderer";
import {
  useFormDefinition,
  useFormVersion,
} from "@/features/forms/hooks/useFormDefinition";
import {
  evaluateVisibility,
  normalizeLayoutSchema,
} from "@/features/forms/lib/layout";
import { fromRequestValues } from "@/features/forms/lib/values";
import type {
  FormFieldView,
  LayoutItem,
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
    if (field?.type === "NUMBER" && typeof value === "number") {
      return new Intl.NumberFormat().format(value);
    }
    if (Array.isArray(value)) return value.map(String).join(", ");
    return String(value);
  };
}

/**
 * A request's submitted values, rendered against its pinned FormVersion
 * (GET /forms/versions/:versionId, ADR-005). Read-only unless `editing`, when
 * the creator can edit + save DRAFT values in place.
 */
export function RequestFormData({
  requestId,
  formId,
  formVersionId,
  values,
  editing = false,
  onEditingChange,
  onSaved,
}: {
  requestId: string;
  formId: string;
  formVersionId?: string;
  values: RequestValueView[];
  /** Whether the form is in edit mode (driven from the top action bar). */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useT();
  const pinned = useFormVersion(formVersionId ?? "");
  const latest = useFormDefinition(formVersionId ? "" : formId);
  const { form, loading } = formVersionId ? pinned : latest;

  const format = useValueFormatter();
  const { notify } = useNotifications();

  const valueMap = useMemo(
    () =>
      fromRequestValues(
        values.map((v) => ({ fieldKey: v.fieldKey, value: v.value })),
      ),
    [values],
  );

  const normalizedLayout = useMemo(
    () =>
      form
        ? normalizeLayoutSchema(form.name, form.fields, form.layoutSchema)
        : null,
    [form],
  );

  const fieldByKey = useMemo(
    () => new Map((form?.fields ?? []).map((f) => [f.key, f])),
    [form],
  );

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
          <div key={i} className="h-5 animate-pulse rounded bg-surface-secondary" />
        ))}
      </div>
    );
  }

  // Edit mode: render the generic form engine pre-filled with pinned version.
  if (editing && form) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Badge tone="neutral">
            {t("requestDetail.formVersionBadge", { version: form.version })}
          </Badge>
        </div>
        <FormRenderer
          form={form}
          initialValues={valueMap}
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

  // Read-only layout-aware rendering (pinned FormVersion)
  if (form && normalizedLayout) {
    const visibleSections = normalizedLayout.sections.filter((sec) =>
      evaluateVisibility(sec.visibleWhen, valueMap),
    );
    const showNumbers = normalizedLayout.settings?.showSectionNumbers !== false;
    const strayValues = values.filter((v) => !fieldByKey.has(v.fieldKey));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Badge tone="neutral">
            {t("requestDetail.formVersionBadge", { version: form.version })}
          </Badge>
        </div>

        {visibleSections.map((sec, sIdx) => {
          const visibleRows = sec.rows
            .map((row) => ({
              ...row,
              items: row.items.filter((item) =>
                evaluateVisibility(item.visibleWhen, valueMap),
              ),
            }))
            .filter((row) => row.items.length > 0);

          if (visibleRows.length === 0) return null;

          return (
            <div
              key={sec.id}
              className="space-y-3 rounded-lg border border-border-subtle bg-surface-secondary/30 p-3.5"
            >
              {normalizedLayout.sections.length > 1 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {showNumbers ? `${sIdx + 1}. ${sec.title}` : sec.title}
                  </h4>
                  {sec.description && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {sec.description}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {visibleRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-3 md:grid-cols-12"
                  >
                    {row.items.map((item) => (
                      <div key={item.id} className={colSpanClass(item.colSpan)}>
                        <ReadOnlyItem
                          item={item}
                          fieldByKey={fieldByKey}
                          valueMap={valueMap}
                          format={format}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {strayValues.length > 0 && (
          <dl className="divide-y divide-border-subtle border-t border-border-subtle pt-2">
            {strayValues.map((v) => (
              <div key={v.fieldKey} className="grid grid-cols-3 gap-4 py-2">
                <dt className="text-xs text-muted-foreground">{v.fieldKey}</dt>
                <dd className="col-span-2 text-sm text-foreground">
                  {format(undefined, v.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  // Fallback when form definition failed to load
  return (
    <dl className="divide-y divide-border">
      {values.map((v) => (
        <div
          key={v.fieldKey}
          className="grid grid-cols-3 gap-4 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-sm text-muted-foreground">{v.fieldKey}</dt>
          <dd className="col-span-2 text-sm text-foreground">
            {format(undefined, v.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReadOnlyItem({
  item,
  fieldByKey,
  valueMap,
  format,
}: {
  item: LayoutItem;
  fieldByKey: Map<string, FormFieldView>;
  valueMap: Record<string, unknown>;
  format: (field: FormFieldView | undefined, value: unknown) => string;
}) {
  if (item.kind === "heading") {
    return (
      <div className="pt-1">
        <p className="text-xs font-semibold text-foreground">{item.text}</p>
        {item.subtitle && (
          <p className="text-[11px] text-muted-foreground">{item.subtitle}</p>
        )}
      </div>
    );
  }
  if (item.kind === "divider") {
    return <hr className="my-1 border-border-subtle" />;
  }
  if (item.kind === "attachmentSlot") {
    return null;
  }

  const field = fieldByKey.get(item.fieldKey);
  if (!field) return null;
  const val = valueMap[field.key];

  if (field.type === "TABLE") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
        <TableFieldRenderer field={field} value={val} readOnly />
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
      <p className="text-sm text-foreground">{format(field, val)}</p>
    </div>
  );
}

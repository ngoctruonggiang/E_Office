"use client";

import { useState, type FormEvent } from "react";
import type { FormDetail, FormValues, RequestValue } from "../types/form";
import { buildInitialValues, toRequestValues } from "../lib/values";
import { validateForm } from "../lib/validation";
import { FormFieldRenderer } from "./FormFieldRenderer";

export type FormRendererProps = {
  /** The form definition returned by GET /forms/:id. */
  form: FormDetail;
  /** Pre-fill values (keyed by field key), e.g. when editing a request. */
  initialValues?: FormValues;
  /**
   * Called with the EAV payload (and raw keyed values) once validation passes.
   * May be async; the submit button shows a pending state while it resolves.
   */
  onSubmit: (
    values: RequestValue[],
    raw: FormValues,
  ) => void | Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
};

/**
 * Generic form render engine. Renders any backend-defined form, manages local
 * state + validation, and emits the EAV payload the request API expects.
 */
export function FormRenderer({
  form,
  initialValues,
  onSubmit,
  submitLabel = "Submit",
  disabled,
}: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(() =>
    buildInitialValues(form, initialValues),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear the field's error as soon as the user edits it.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm(form.fields, values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      setSubmitting(true);
      await onSubmit(toRequestValues(values), values);
    } finally {
      setSubmitting(false);
    }
  };

  const busy = disabled || submitting;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {form.fields.map((field) => (
        <FormFieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          error={errors[field.key]}
          disabled={busy}
          onChange={(v) => setValue(field.key, v)}
        />
      ))}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {submitting ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}

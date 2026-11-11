import { Form, FormField, FormVersion } from '@prisma/client';

/**
 * Domain aliases over the generated Prisma models. Kept thin — the form
 * builder works with these shapes; the assembled view is FormDetailDto.
 */
export type FormEntity = Form;
export type FormVersionEntity = FormVersion;
export type FormFieldEntity = FormField;

/** A version with its fields + nested options/validations (query result). */
export type FormVersionWithFields = FormVersion & {
  fields: (FormField & {
    options: { id: string; label: string; value: string }[];
    validations: { type: string; regex: string | null }[];
  })[];
};

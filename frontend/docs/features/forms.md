# `features/forms` — Generic form render engine

Renders **any** form defined in the backend form-builder, validates input
client-side, and emits the EAV payload the request API expects. One engine
serves every form category — fields, options, and rules all come from the
backend.

## Backend contract

| Concern          | Backend source                                                                     |
| ---------------- | ---------------------------------------------------------------------------------- |
| Form definition  | `GET /forms/:id` → `FormDetailDto` (`be/src/form-builder/dto/form-detail.dto.ts`)  |
| Field shape      | `FormField` (`be/prisma/schema/form.prisma`)                                       |
| Submit a request | `POST /requests` ← `CreateRequestDto` (`be/src/request/dto/create-request.dto.ts`) |

Supported field types (`FieldType`): `TEXT`, `DATE`, `NUMBER`, `SELECT`
(`selectMode` = `SINGLE` | `MULTIPLE`). Validations (`ValidationType`):
`EMAIL`, `PHONE`, `REGEX`.

## File map

```
features/forms/
├── components/
│   ├── FormRenderer.tsx        # the engine: state, validation, submit
│   └── FormFieldRenderer.tsx   # one field → label + type-specific control + error
├── api/
│   └── forms.ts                # getForm(id), submitRequest(input)
├── hooks/
│   └── useFormDefinition.ts    # client-side form loader (loading/error/data)
├── lib/
│   ├── validation.ts           # validateField / validateForm
│   └── values.ts               # build/convert form ↔ EAV values
├── types/
│   └── form.ts                 # FE mirror of the backend DTO
└── index.ts                    # public surface
```

## `<FormRenderer>`

The engine component.

| Prop            | Type                                                                 | Default    | Description                                                           |
| --------------- | -------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `form`          | `FormDetail`                                                         | —          | Definition from `GET /forms/:id`.                                     |
| `initialValues` | `FormValues`                                                         | —          | Pre-fill (keyed by field `key`), e.g. when editing.                   |
| `onSubmit`      | `(values: RequestValue[], raw: FormValues) => void \| Promise<void>` | —          | Called after validation passes. Async → button shows a pending state. |
| `submitLabel`   | `string`                                                             | `"Submit"` | Submit button text.                                                   |
| `disabled`      | `boolean`                                                            | —          | Disable every control + submit.                                       |

It owns the value + error state internally. `onSubmit` receives the
backend-ready EAV array (`{ fieldKey, value }[]`) plus the raw keyed values.

### Value representation per field type

| Field type        | JS value                            |
| ----------------- | ----------------------------------- |
| `TEXT`, `DATE`    | `string` (`DATE` is `"YYYY-MM-DD"`) |
| `NUMBER`          | `number` (or `""` while empty)      |
| `SELECT` single   | option `value: string`              |
| `SELECT` multiple | `string[]` of option values         |

`buildInitialValues` seeds each field from `initialValues` → `defaultValue` →
an empty value, so the inputs stay controlled from first render.

## Validation

`validateForm(fields, values)` returns a `{ [fieldKey]: message }` map; the
engine runs it on submit and blocks if non-empty, clearing a field's error as
soon as it's edited. Rules applied by `validateField`:

- **required** — non-empty (empty string, `null`, or empty array all fail).
- **TEXT** — `maxLength`.
- **NUMBER** — numeric, `min`, `max`.
- **SELECT** — selected value(s) must exist in `options`.
- **EMAIL / PHONE / REGEX** — format checks; malformed backend regex is ignored.

## API layer

```ts
getForm(id: string): Promise<FormDetail>
submitRequest(input: SubmitRequestInput): Promise<unknown>
// SubmitRequestInput = { formId, values, submit?, viewerIds? }
```

Both go through `@/lib/api/client` (`apiFetch`), which prefixes
`NEXT_PUBLIC_API_URL` (default `http://localhost:3333`), sends/receives JSON
with credentials, and throws `ApiError` on non-2xx.

## Usage

### Server Component (recommended) — fetch on the server, render on the client

```tsx
// app/(main)/forms/[id]/page.tsx
import { getForm } from "@/features/forms";
import { CreateRequestForm } from "./CreateRequestForm";

export default async function Page({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = await getForm(id);
  return <CreateRequestForm form={form} />;
}
```

```tsx
// CreateRequestForm.tsx
"use client";
import { FormRenderer, submitRequest, type FormDetail } from "@/features/forms";

export function CreateRequestForm({ form }: { form: FormDetail }) {
  return (
    <FormRenderer
      form={form}
      submitLabel="Create request"
      onSubmit={async (values) => {
        await submitRequest({ formId: form.id, values, submit: true });
      }}
    />
  );
}
```

### Client Component — fetch in the browser

```tsx
"use client";
import {
  FormRenderer,
  useFormDefinition,
  submitRequest
} from "@/features/forms";

export function FormById({ id }: { id: string }) {
  const { form, loading, error } = useFormDefinition(id);
  if (loading) return <p>Loading…</p>;
  if (error || !form) return <p>Failed to load form.</p>;

  return (
    <FormRenderer
      form={form}
      onSubmit={(values) => submitRequest({ formId: form.id, values })}
    />
  );
}
```

### Editing an existing request

```tsx
import { fromRequestValues } from "@/features/forms";

<FormRenderer
  form={form}
  initialValues={fromRequestValues(request.values)}
  submitLabel="Save"
  onSubmit={(values) => updateRequest(request.id, { values })}
/>;
```

## Extending

- **New field type:** add it to `FieldType` in `types/form.ts`, render a control
  in `FormFieldRenderer`, and add validation in `lib/validation.ts`.
- **Custom widgets:** `FormFieldRenderer` uses native inputs styled with
  Tailwind; swap them for shared `components/ui` primitives as they're built.

## Related

- [Project structure & layout](../README.md)
- Backend: `be/src/form-builder`, `be/src/request`, `be/prisma/schema/form.prisma`

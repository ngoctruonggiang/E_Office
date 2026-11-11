# Form Builder — Controller & DTOs

`FormBuilderController` (`src/modules/form-builder/form-builder.controller.ts`), base
path `/forms`. All endpoints require a valid access token.

A **Form** is a generic request template (a category). It owns versioned field
sets (`FormVersion`); requests reference a specific version, so old requests are
unaffected by later edits.

## Endpoints

| Method | Path | Body | Returns | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/forms` | — | `FormSummaryDto[]` | List all form categories (the "pick a form" picker). |
| POST | `/forms` | `CreateFormDto` | `FormDetailDto` | Create a form + version 1. |
| PATCH | `/forms/:id` | `UpdateFormDto` | `FormDetailDto` | Update (may bump version). |
| POST | `/forms/:id/fields/:fieldId/options` | `AddOptionDto` | `FormDetailDto` | add_item to a SELECT field. |
| GET | `/forms/:id` | — | `FormDetailDto` | Assembled latest version for the frontend. |

### PATCH /forms/:id — versioning rule
If any incoming field changes its `type` or introduces a **new** `key`, a new
`FormVersion` is created from the full incoming field set. Otherwise the current
version's fields are updated **in place** (scalar props only). `name` can be
updated independently.

### POST …/options — add_item
Appends an option to an existing field. `400` if the field is not a `SELECT`
type; `404` if the field doesn't belong to the form.

## DTOs

### FormFieldInput (shared by create/update)
| Field | Type | Notes |
| --- | --- | --- |
| `key` | string | machine key, ≤ 100, referenced by request values |
| `label` | string | display label |
| `type` | `FieldType` | `TEXT \| DATE \| NUMBER \| SELECT` |
| `required?` | boolean | default false |
| `defaultValue?` | any (JSON) | stored as Json |
| `maxLength?`, `placeholder?` | number / string | TEXT extras |
| `min?`, `max?` | number | NUMBER extras |
| `selectMode?` | `SelectMode` | `SINGLE \| MULTIPLE` (SELECT) |
| `options?` | `{ label, value }[]` | SELECT options |
| `validations?` | `{ type, regex? }[]` | `type ∈ EMAIL \| PHONE \| REGEX` |

### CreateFormDto (request)
`name` (string), `fields` (≥ 1 `FormFieldInput`). A form holds only basic
field definitions — it has no approval flow. The approval flow belongs to
the request and is built by the requester (see `docs/request`).

### UpdateFormDto (request)
`name?`, `fields?` (`FormFieldInput[]`).

### AddOptionDto (request)
`label` (string), `value` (string).

### FormSummaryDto (response)
```jsonc
{ "id": "...", "name": "Leave Request", "latestVersion": 2, "createdAt": "2026-..." }
```

### FormDetailDto (response)
```jsonc
{
  "id": "...", "name": "...",
  "version": 1, "versionId": "...",
  "fields": [{
    "id": "...", "key": "reason", "label": "Reason", "type": "TEXT",
    "required": true, "defaultValue": null,
    "maxLength": null, "placeholder": null, "min": null, "max": null,
    "selectMode": null,
    "options": [{ "id": "...", "label": "Annual", "value": "annual" }],
    "validations": [{ "type": "REGEX", "regex": "..." }]
  }]
}
```

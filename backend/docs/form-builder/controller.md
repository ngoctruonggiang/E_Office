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
| PATCH | `/forms/:id` | `UpdateFormDto` | `FormDetailDto` | Update (may bump version; forks whenever `responses > 0` or structure changes). |
| POST | `/forms/:id/fields/:fieldId/options` | `AddOptionDto` | `FormDetailDto` | add_item to a SELECT field. |
| GET | `/forms/versions/:versionId` | — | `FormDetailDto` | Assembled pinned `FormVersion` (ADR-005). |
| GET | `/forms/:id` | — | `FormDetailDto` | Assembled latest version for the frontend. |

### PATCH /forms/:id — versioning rule
If any field changes `type` / `TABLE` columns, adds/removes a `key`, or `responses > 0` on the current version with any field/layout edit, a new `FormVersion` is created (`version + 1`). Only unused versions (`responses === 0`) with identical keys & types patch **in place**. `name` can be updated independently.

### POST …/options — add_item
Appends an option to an existing field. `400` if the field is not a `SELECT`
type; `404` if the field doesn't belong to the form.

## DTOs

### FormFieldInput (shared by create/update)
| Field | Type | Notes |
| --- | --- | --- |
| `key` | string | machine key, ≤ 100, referenced by request values |
| `label` | string | display label |
| `type` | `FieldType` | `TEXT \| DATE \| NUMBER \| SELECT \| TABLE` |
| `required?` | boolean | default false |
| `defaultValue?` | any (JSON) | stored as Json |
| `maxLength?`, `placeholder?` | number / string | TEXT extras |
| `min?`, `max?` | number | NUMBER extras |
| `selectMode?` | `SelectMode` | `SINGLE \| MULTIPLE` (SELECT) |
| `tableConfig?` | `TableFieldConfig` | TABLE columns, min/maxRows, summary aggregates |
| `options?` | `{ label, value }[]` | SELECT options |
| `validations?` | `{ type, regex? }[]` | `type ∈ EMAIL \| PHONE \| REGEX` |

### CreateFormDto (request)
`name` (string), `fields` (≥ 1 `FormFieldInput`), `layoutSchema?` (`LayoutSchemaV1 | null`). A form holds field definitions and optional layout presentation — approval flow belongs to the request.

### UpdateFormDto (request)
`name?`, `fields?` (`FormFieldInput[]`), `layoutSchema?` (`LayoutSchemaV1 | null`).

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
  "layoutSchema": null,
  "fields": [{
    "id": "...", "key": "reason", "label": "Reason", "type": "TEXT",
    "required": true, "defaultValue": null,
    "maxLength": null, "placeholder": null, "min": null, "max": null,
    "selectMode": null, "tableConfig": null,
    "options": [{ "id": "...", "label": "Annual", "value": "annual" }],
    "validations": [{ "type": "REGEX", "regex": "..." }]
  }]
}
```

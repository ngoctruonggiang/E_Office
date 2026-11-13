# Form Builder — Services

## FormBuilderService (`form-builder/form-builder.service.ts`)
Manages forms, versions, fields, options and validations. Writes are wrapped in
Prisma transactions so a form is never left half‑built.

| Method | Signature | Behaviour |
| --- | --- | --- |
| `listForms` | `() → FormSummaryDto[]` | Lists every form category with its latest version number — the "pick a form" picker for the frontend. |
| `createForm` | `(userId, CreateFormDto) → FormDetailDto` | Creates `Form` + `FormVersion(version: 1)` and all fields (with options/validations) in one transaction. |
| `updateForm` | `(formId, UpdateFormDto) → FormDetailDto` | Updates `name`; for `fields`, decides new‑version vs in‑place (see rule below). |
| `addOption` | `(formId, fieldId, AddOptionDto) → FormDetailDto` | Appends a `FieldOption`; throws `400` unless the field is `SELECT`, `404` if not on the form. |
| `getForm` | `(formId) → FormDetailDto` | Loads the **latest** version with `layoutSchema`, fields, `tableConfig`, options and validations, assembled for the frontend. |
| `getFormVersion` | `(versionId) → FormDetailDto` | Loads a **specific `FormVersion`** by id so historical requests render with their pinned layout/schema (ADR-005). |

### Structural Validation & Versioning rule (`createForm` / `updateForm`)
- `validateFormStructure(fields, layoutSchema)` (`validators/layout.validator.ts`) checks unique field keys, valid `TABLE` config & numeric aggregate targets, row `colSpan <= 12`, and acyclic `visibleWhen` dependency graph (returns `400` with structured `details[]`).
- **Versioning rule (`updateForm`):** forks a new `FormVersion` whenever a field key is added/removed (structural change), `type` or `TABLE` columns change, OR the current version already has `responses > 0` and any field/layout edit is submitted. Otherwise (`responses === 0` with existing keys & matching types) updates scalars, `layoutSchema`, `tableConfig`, `options`, and `validations` **in place**.

### Helpers
- `createFields(tx, versionId, fields)` — bulk‑creates fields, then
  `createMany` for their options and validations.
- `jsonField('defaultValue', value)` — builds a Json column patch that maps
  `undefined` to "leave unset" (so Prisma doesn't overwrite with null).

### Entity types (`entities/form.entity.ts`)
Thin aliases over the generated Prisma models (`FormEntity`,
`FormVersionEntity`, `FormFieldEntity`) plus `FormVersionWithFields` for the
assembled query shape.

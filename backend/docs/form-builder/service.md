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
| `getForm` | `(formId) → FormDetailDto` | Loads the **latest** version with fields, options and validations, assembled for the frontend. |

### Versioning rule (`updateForm`)
```
needsNewVersion = incoming fields .some(f =>
    !current.has(f.key)        // a new field key, OR
 || current[f.key].type != f.type   // a field changed type
)
```
- **true** → create `FormVersion(version + 1)` and rebuild fields from the
  incoming set. Existing requests keep pointing at their old version.
- **false** → update each existing field in place (label, required, placeholder,
  min, max, maxLength, selectMode, defaultValue). Options/validations are not
  diffed here — use `addOption` (add_item) for SELECT options.

### Helpers
- `createFields(tx, versionId, fields)` — bulk‑creates fields, then
  `createMany` for their options and validations.
- `jsonField('defaultValue', value)` — builds a Json column patch that maps
  `undefined` to "leave unset" (so Prisma doesn't overwrite with null).

### Entity types (`entities/form.entity.ts`)
Thin aliases over the generated Prisma models (`FormEntity`,
`FormVersionEntity`, `FormFieldEntity`) plus `FormVersionWithFields` for the
assembled query shape.

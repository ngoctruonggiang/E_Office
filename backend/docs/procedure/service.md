# ProcedureService & ProcedureValidationService

**Module:** `ProcedureModule` (`backend/src/modules/procedure`)  
**Scope:** Core business logic for Procedure management, mapping Form with Operaton Workflow, version pinning (ADR-005), and pre-publish validation.

---

## 1. Services Overview

### `ProcedureService`
Provides high-level management of Procedures and ProcedureVersions:
- `create(createdById, dto)`: Validates code uniqueness, creates `Procedure`, initializes `ProcedureVersion v1 (DRAFT)`.
- `findAll(query, userRole)`: Lists procedures with search, filter, and pagination. Non-admin users only see procedures with an active `PUBLISHED` version.
- `findById(id)`: Returns procedure details including `activeVersion` and version history.
- `update(id, dto)`: Updates general metadata (name, description, department, icon, color).
- `delete(id)`: Cascades delete procedure and its draft/published versions.
- `getVersionById(versionId)`: Returns full version structure including form layout, fields, actor mappings (with user details), variable mappings, and workflow structure from Operaton.
- `createDraftVersion(procedureId, createdById)`: Clones existing published/latest version into a new `DRAFT` version (`version: max + 1`).
- `updateDraftVersion(versionId, dto)`: Replaces actor and variable mappings for a draft version. Throws `403 Forbidden` if version is already published or archived.
- `publishVersion(versionId, userId)`: Validates the draft version with `ProcedureValidationService`. If valid, archives previous published versions, sets status to `PUBLISHED`, caches BPMN XML snapshot, and updates `procedure.activeVersionId`.
- `getDirectory(search, departmentId)`: Returns active users with department, title, email, and signature image for assignee autocomplete pickers.

### `ProcedureValidationService`
Executes pre-publish validation rules (`VAL-PRC-01` to `VAL-PRC-09`):
1. `VAL-PRC-01`: FormVersion exists and contains at least 1 field.
2. `VAL-PRC-02`: Operaton Workflow exists and structure can be parsed.
3. `VAL-PRC-03`: All `conditionVariables` extracted from BPMN are mapped.
4. `VAL-PRC-04`: Mapped `formFieldKey` exists in `FormVersion.fields`.
5. `VAL-PRC-05`: Warning on type mismatches (e.g. TEXT field mapped to NUMBER variable).
6. `VAL-PRC-06`: All `UserTask` nodes in BPMN have an actor mapping.
7. `VAL-PRC-07`: Steps with `allowOverride = false` and `required = true` must have `defaultUserId`.
8. `VAL-PRC-08`: Assigned default user must exist and be active (`isActive = true`).
9. `VAL-PRC-09`: Multi-instance steps must specify `collectionVariable`.


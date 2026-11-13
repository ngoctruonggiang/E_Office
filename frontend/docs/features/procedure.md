# Feature: Procedures (Thủ tục Doanh nghiệp)

**Module:** `Procedure` (`frontend/features/procedure`)  
**Scope:** Connecting Form Engine (Phase 2) with Operaton BPMN Engine (Phase 3) into executable, standardized business procedures.

---

## 1. Overview & Architecture

A **Procedure** represents a formalized enterprise process (e.g., *Equipment Purchase Request*, *Leave Application*). It binds:
1. A **FormVersion** (layout schema, dynamic repeater tables, conditional fields).
2. An **Operaton ProcessDefinition** (BPMN 2.0 flow with gateways, parallel joins, user tasks).
3. **Dynamic Variable Mapping (`ProcedureVariableMapping`):**
   - Automatically maps form inputs (`FormField.key`) to BPMN gateway condition variables (`var_*`).
   - Supports type casting to `NUMBER`, `STRING`, `BOOLEAN` with fallback values.
4. **Actor Assignment Mapping (`ProcedureActorMapping`):**
   - Assigns default users to each `UserTask` in the workflow.
   - Rich autocomplete user directory showing **Name, Email, Department, and Job Title**.
   - Configurable `allowOverride` flag: enables requesters at runtime (Phase 5) to customize or override approvers as needed.

---

## 2. Components Breakdown

- `ProcedureList`: Paginated list of procedures with code, name, department, active version badges, and search filter.
- `CreateProcedureForm`: Modal/form to create a new procedure with code and metadata, redirecting to the builder.
- `ProcedureBuilder`:
  - `GeneralInfoTab`: Metadata, code, name, description, visual identity (icon & color).
  - `FormAndWorkflowTab`: Split-view selector for Form Version and Operaton BPMN Workflow.
  - `VariableMappingTab`: Condition variable mapping table with live form fields dropdown.
  - `ActorMappingTab`: UserTask approver assignment with user directory picker, `allowOverride`, and `required` toggles.
  - `ValidationDrawer`: Slide-over inspection drawer displaying blocker errors (`VAL-PRC-01` to `VAL-PRC-09`) and warnings.
  - `PublishConfirmModal`: Pre-publish review dialog explaining immutability and version pinning (ADR-005).

---

## 3. Routes

- `/procedures`: Procedure catalog view.
- `/procedures/new`: Procedure creation screen.
- `/procedures/[id]/versions/[versionId]`: 4-tab visual procedure designer.


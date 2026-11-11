# Request — Services

## RequestService (`request/request.service.ts`)
Owns the request (`FormResponse`) lifecycle and its EAV values, and delegates
all workflow actions to `ApprovalEngineService` (injected via
`ApprovalFlowModule`).

| Method | Signature | Behaviour |
| --- | --- | --- |
| `create` | `(userId, CreateRequestDto) → RequestDetailDto` | Resolves the form's latest version; in a transaction creates the `FormResponse` (`DRAFT`), `createMany` the EAV values, adds viewers, and — if `dto.steps` is given — builds a brand‑new `Flow`/`FlowStep`/`FlowAssignee` set for **this request only** (forms carry no fixed flow), then appends a required final `CLOSE` step assigned to the requestor (`finalStepName` label). If `submit !== false`, calls `engine.startFlow(responseId, flowId)`. |
| `update` | `(userId, id, UpdateRequestDto) → RequestDetailDto` | Creator‑only, while `DRAFT`/`PENDING`/`REQUEST_CHANGES`. Upserts each value on the unique `(responseId, fieldKey)` key. |
| `cloneReserve` | `(userId, id) → RequestDetailDto` | `clone(…, 'reserve')`. |
| `cloneReset` | `(userId, id) → RequestDetailDto` | `clone(…, 'reset')`. |
| `approve` | `(userId, id, ApprovalActionDto) → FlowStatusDto` | → `engine.act(userId, id, action)`. `REQUEST_CHANGES` pauses the flow and sets the request to `REQUEST_CHANGES`. |
| `revise` | `(userId, id, mode) → RequestDetailDto` | Requestor‑only, while `REQUEST_CHANGES`. Clones (reset\|reserve) and CANCELs the original. `reserve` re‑opens the change step keeping earlier approvals. |
| `resubmit` | `(userId, id) → RequestDetailDto` | Requestor‑only, while `REQUEST_CHANGES`. Discards the flow instance + tasks and restarts the same flow from step 1 (`PENDING`). |
| `submitDraft` | `(userId, id, SubmitDraftDto) → RequestDetailDto` | Requestor‑only, `DRAFT` only. Replaces viewers, (re)builds the flow via `buildFlow`, and starts it. Finalizes an edited cloned draft. |
| `cancelByRequestor` | `(userId, id) → RequestDetailDto` | Requestor‑only, while DRAFT/PENDING/REQUEST_CHANGES. Cancels pending tasks + marks the request `CANCELLED`. |
| `requestChangesByRequestor` | `(userId, id) → RequestDetailDto` | Requestor‑only, while `PENDING`. Cancels pending tasks + sets `REQUEST_CHANGES` (pull‑back). |
| `getHistory` | `(id) → RequestSummaryDto[]` | Walks `clonedFromId` to the root; returns the ancestor chain oldest → newest. |
| `forward` | `(userId, id, toUserId) → FlowStatusDto` | → `engine.forward(...)`. |

`buildFlow(tx, responseId, creatorId, {steps, flowName, finalStepName})` is the
shared flow builder (used by `create` + `submitDraft`): creates the `Flow` +
steps + assignees and appends the final `CLOSE` step. `clone` now also copies
viewers + document links and records `cloneMode` (`reset`/`reserve`).
| `getMine` | `(userId, formId?) → RequestSummaryDto[]` | `where createdById = userId`, optionally narrowed to one form category. |
| `getByDuty` | `(userId, formId?) → RequestSummaryDto[]` | Requests whose flow has a **pending** task for the user, optionally narrowed to one form category. |
| `getByViewer` | `(userId, formId?) → RequestSummaryDto[]` | `where viewers.some(userId) AND NOT createdById = userId`, optionally narrowed to one form category. |
| `getOne` | `(id) → RequestDetailDto` | Detail with values, viewer ids, document ids, and the **full approval flow** (`engine.getStatus(id)`). |

### EAV storage
Each field value is one `FormResponseValue` row: `(responseId, fieldKey, value)`
where `value` is a Json column. A unique constraint on `(responseId, fieldKey)`
makes `update` an idempotent upsert — one value per field per request, and a
single table serves every form category.

### clone(mode) — private
Loads the source request (with values and, for reserve, its flow instance +
tasks) and, in a transaction:
1. Creates a new `FormResponse` with `clonedFromId = source.id`; status is
   `DRAFT` for **reset** or the source status for **reserve**.
2. `createMany` copies all EAV values.
3. **reserve only:** recreates the `FlowInstance` (same `currentStep`/`isDone`)
   and `createMany` copies every task with its `status`, `action`, `actedAt`,
   `dueDate` — preserving already‑granted approvals. When the source is
   `REQUEST_CHANGES` (a revise), the clone instead re‑opens the change step:
   the cancelled siblings and the `REQUEST_CHANGES` task are reset to `PENDING`
   and the clone starts `PENDING`, so the flow resumes there.

### Mapping
`toSummary(row)` projects the joined form id/name + version into
`RequestSummaryDto`; `getOne` extends it with values/viewers/documents plus a
call to `ApprovalEngineService.getStatus(id)` to build `RequestDetailDto`. A
shared `summaryInclude` keeps the list queries consistent, and each list
method accepts an optional `formId` to filter by kind of form.

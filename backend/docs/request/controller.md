# Request — Controller & DTOs

`RequestController` (`src/modules/request/request.controller.ts`), base path `/requests`.
All endpoints require a valid access token.

A **request** is a filled‑in form (a `FormResponse`). Its field values are
stored EAV‑style. The form itself only defines basic fields — it carries no
approval flow. Instead, the requester builds their own flow (steps +
assignees) when creating the request (`CreateRequestDto.steps`); on submit it
enters that flow, and assignees act via `POST /requests/:id/approval`.

> Route order: the static list routes (`/mine`, `/duty`, `/viewable`) are
> declared **before** `/:id` so they aren't shadowed by the param route.

## Endpoints

| Method | Path | Body | Returns | Purpose |
| --- | --- | --- | --- | --- |
| POST | `/requests` | `CreateRequestDto` | `RequestDetailDto` | Create (EAV) + optionally submit. |
| GET | `/requests/mine?formId=` | — | `RequestSummaryDto[]` | Requests I created, optionally narrowed to one kind of form. |
| GET | `/requests/duty?formId=` | — | `RequestSummaryDto[]` | Requests where I have a pending task, optionally narrowed to one kind of form. |
| GET | `/requests/viewable?formId=` | — | `RequestSummaryDto[]` | Requests I may view (excludes my own), optionally narrowed to one kind of form. |
| GET | `/requests/:id` | — | `RequestDetailDto` | One request with its values and full approval flow. |
| PATCH | `/requests/:id` | `UpdateRequestDto` | `RequestDetailDto` | Update field values only. |
| POST | `/requests/:id/clone-reserve` | — | `RequestDetailDto` | Copy values + prior approvals. |
| POST | `/requests/:id/clone-reset` | — | `RequestDetailDto` | Copy values, fresh state. |
| POST | `/requests/:id/approval` | `ApprovalActionDto` | `FlowStatusDto` | Approve/request-changes/reject/act. |
| POST | `/requests/:id/revise` | `RequestChangesDto` | `RequestDetailDto` | Requestor clones a returned request; original → CANCELLED. |
| POST | `/requests/:id/resubmit` | — | `RequestDetailDto` | Requestor restarts the flow in place after editing. |
| POST | `/requests/:id/submit` | `SubmitDraftDto` | `RequestDetailDto` | Requestor finalizes a DRAFT (e.g. an edited clone): builds the flow + viewers and starts it. |
| POST | `/requests/:id/cancel` | — | `RequestDetailDto` | Requestor cancels directly (DRAFT/PENDING/REQUEST_CHANGES), independent of the flow. |
| POST | `/requests/:id/request-changes` | — | `RequestDetailDto` | Requestor pulls a PENDING request back to REQUEST_CHANGES (cancels pending approver tasks). |
| GET | `/requests/:id/history` | — | `RequestSummaryDto[]` | Clone lineage (ancestor chain), oldest → newest. |
| POST | `/requests/:id/forward` | `ForwardDto` | `FlowStatusDto` | Reassign the caller's current task. |

### POST /requests
Resolves the form's latest version, creates the `FormResponse` (status `DRAFT`),
writes the EAV values, optionally adds viewers, and — if `steps` is given —
builds a new `Flow` for this request from the supplied steps/assignees. Unless
`submit: false`, it then starts that flow (`PENDING`), or auto‑approves if no
`steps` were given.

### PATCH /requests/:id
Creator‑only; allowed while status is `DRAFT` or `PENDING`. Upserts the provided
field values (one row per `fieldKey`). `403` if not the creator, `400` if the
request is finalized.

### POST /requests/:id/clone-reserve vs clone-reset
- **reserve** — new request, copies all values **and** snapshots the flow
  instance + task statuses, so approvals already granted carry over. Status is
  inherited from the source.
- **reset** — new request, copies all values only; status `DRAFT`, no approvals.

Both set `clonedFromId` to the source request.

### POST /requests/:id/approval
Delegates to the approval engine for the caller's pending task on the current
step. Returns the updated `FlowStatusDto`. `403` if the caller has no pending
task; `400` if the flow already finished. Handles `APPROVE` / `REJECT` /
`CANCEL` / `COMPLETE` and `REQUEST_CHANGES`; use `/forward` for `FORWARD`.

- **REQUEST_CHANGES** records the approver's action, cancels any sibling tasks
  still pending on the step, and sets the request to `REQUEST_CHANGES` (the flow
  pauses, it is *not* finished). The request is handed back to the requestor.

### Final "close" step
Whenever the requester builds an approval flow, the server appends one required
final step (`isFinal`, `SEQUENTIAL`) assigned to the requestor with a `CLOSE`
duty. After every approver step completes, the requestor confirms (`COMPLETE`)
on this step to finalize the request (`APPROVED`). Its label comes from
`CreateRequestDto.finalStepName` (optional).

### POST /requests/:id/revise vs /resubmit (requestor, while REQUEST_CHANGES)
The requestor decides how to handle a returned request:
- **revise** (`{ mode: reset|reserve }`) — clone the request and CANCEL the
  original. `reset` → fresh `DRAFT` clone; `reserve` → clone re-opened at the
  step where changes were requested, keeping earlier approvals (`PENDING`).
- **resubmit** — edit values in place (`PATCH` is allowed while
  `REQUEST_CHANGES`) then restart the same flow from step 1 (`PENDING`).

Both are creator-only and require the request to be in `REQUEST_CHANGES`.

### Editing a cloned draft (`/submit`)
`clone`/`revise` carry over the source's **values, documents and viewers** (and
set `cloneMode`), so a reset clone lands as a fully-populated `DRAFT`. The
requestor edits values (`PATCH`), documents (the document endpoints), and the
flow, then `POST /submit` with the flow `steps` + `viewerIds` to (re)build the
flow and start it (auto-approved if no steps). Creator-only, `DRAFT` only.

### Requestor self-actions (`/cancel`, `/request-changes`)
These let the requestor act on their own request without holding a flow task:
`/cancel` → `CANCELLED` (while not finalized); `/request-changes` → pulls a
`PENDING` request back to `REQUEST_CHANGES`, cancelling pending approver tasks.
(The approver's REQUEST_CHANGES still goes through `/approval`.)

### Clone history (`/history`)
Walks `clonedFromId` back to the root, returning the chain oldest → newest (the
current request last). Each entry carries `cloneMode` (`reset`/`reserve`) so the
UI can show how each version was derived; entries link to read-only old versions.

## DTOs

### CreateRequestDto (request)
| Field | Type | Notes |
| --- | --- | --- |
| `formId` | string | the form category |
| `values` | `RequestValueInput[]` | EAV values |
| `submit?` | boolean | default **true** — start the flow now; `false` keeps a DRAFT |
| `viewerIds?` | string[] | users allowed to view this request |
| `steps?` | `CreateFlowStepInput[]` | the approval flow for **this request**, built by the requester; omit to skip approval (auto‑approved) |
| `flowName?` | string | optional name for the flow created for this request |
| `finalStepName?` | string | optional label for the auto‑appended final close step |

`CreateFlowStepInput`: `{ order: number, mode: FlowMode, name?: string, assignees: CreateFlowAssigneeInput[] }`
(`name` is an optional creator‑given label, shown under "Step N").
`CreateFlowAssigneeInput`: `{ userId: string, order?: number, type?: TaskType }`
(`type` defaults to `APPROVAL`). Defined in `approval-flow/dto/create-flow.dto.ts`
and reused here since there is no per-form fixed flow.

`RequestValueInput`: `{ fieldKey: string, value: any }` — `value` is whitelisted
with `@Allow()` so arbitrary JSON survives the validation pipe.

### UpdateRequestDto (request)
`{ values: RequestValueInput[] }`.

### ApprovalActionDto (request)
`{ action: TaskAction, comment? }` where
`TaskAction ∈ APPROVE | REQUEST_CHANGES | REJECT | FORWARD | COMPLETE | CANCEL`.
`comment` is accepted but not persisted in this version.

### RequestSummaryDto / RequestDetailDto (response)
```jsonc
// summary (list items) — formId is the kind of form, for filtering/grouping
{ "id": "...", "status": "PENDING", "formId": "...", "formName": "Leave Request",
  "formVersionId": "...", "version": 1, "createdById": "...",
  "clonedFromId": null, "createdAt": "2026-..." }

// detail extends summary with values, viewers, documents AND the full flow:
{ "values": [{ "fieldKey": "reason", "value": "vacation" }],
  "viewerIds": ["..."], "documentIds": ["..."],
  "flow": { /* FlowStatusDto — see approval-flow/controller.md */ } }
```
`status ∈ DRAFT | PENDING | REQUEST_CHANGES | APPROVED | REJECTED | CANCELLED`.

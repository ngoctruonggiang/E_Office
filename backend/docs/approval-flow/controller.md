# Approval Flow — Controller & DTOs

`ApprovalFlowController` (`src/modules/approval-flow/approval-flow.controller.ts`), base
path `/approval-flows`. Requires a valid access token.

This controller is **read‑only** — it reports a request's approval progress. The
acting endpoint (approve/reject) lives on the request controller
(`POST /requests/:id/approval`), which calls the same engine.

## Endpoints

| Method | Path | Returns | Purpose |
| --- | --- | --- | --- |
| GET | `/approval-flows/:requestId` | `FlowStatusDto` | Status of a request's flow. |

### GET /approval-flows/:requestId
Returns the flow snapshot for the request. If the requester didn't build a
flow when creating the request, `hasFlow` is `false` and `tasks` is empty
(the request was auto‑approved on create). `404` if the request id doesn't
exist.

## DTOs

### FlowStatusDto (response)
```jsonc
{
  "requestId": "...",
  "requestStatus": "PENDING",     // DRAFT|PENDING|REQUEST_CHANGES|APPROVED|REJECTED|CANCELLED
  "hasFlow": true,
  "isDone": false,
  "currentStep": 2,               // order of the active step; null when none/finished
  "tasks": [ /* FlowTaskView[] */ ],
  "steps": [ /* FlowStepStatusView[] — full blueprint, see below */ ]
}
```

### FlowStepStatusView (the planned flow)
Each entry is one step of the blueprint, every assignee merged with their task
state, so the frontend can render the full planned flow (not just activated
tasks): `{ order, mode, name, isFinal, isCurrent, assignees[] }`.
- `name` — optional creator label (shown under "Step N"); `null` if blank.
- `isFinal` — the auto‑appended final `CLOSE` step where the requestor closes
  the flow.

### FlowTaskView
```jsonc
{
  "id": "...",
  "stepOrder": 1,
  "stepMode": "SEQUENTIAL",        // SEQUENTIAL | PARALLEL
  "assignee": { "id": "...", "email": "...", "displayName": null },
  "type": "APPROVAL",              // APPROVAL | ACTION | CLOSE (the assignee's duty)
  "status": "DONE",                // PENDING | DONE | CANCELLED
  "action": "APPROVE",             // APPROVE|REQUEST_CHANGES|REJECT|FORWARD|COMPLETE|CANCEL | null
  "actedAt": "2026-..." | null
}
```
Tasks are returned sorted by `stepOrder`. A task is the **action** the engine
created for an assignee, carrying their own duty (`type`).

### ApprovalActionDto
The body for acting on a request lives here and is reused by the request
controller — see [request/controller.md](../request/controller.md).

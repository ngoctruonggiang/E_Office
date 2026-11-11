# Approval Flow — Services

## ApprovalEngineService (`approval-flow/approval-engine.service.ts`)
Drives the workflow. Steps run in `order` sequence; behaviour **within** a step
depends on `FlowStep.mode`.

| Method | Signature | Behaviour |
| --- | --- | --- |
| `startFlow` | `(responseId, flowId?) → void` | Instantiates the flow the requester built for this request (`flowId`, created in `RequestService.create`) and activates step 1; if no `flowId` was given the request is auto‑`APPROVED`. Sets request `PENDING`. |
| `act` | `(userId, responseId, action) → FlowStatusDto` | Applies the caller's action to their pending task on the current step, then advances the flow. |
| `getStatus` | `(responseId) → FlowStatusDto` | Read‑only snapshot (used by the GET endpoint and after every `act`). |

### Step semantics
- **PARALLEL** — on activation, every assignee gets a `PENDING` task at once. The
  step completes only when **all** assignees have a `DONE` task.
- **SEQUENTIAL** — on activation, only the first assignee (by `order`) gets a
  task. Each approval hands off to the next assignee with no task yet. The step
  completes when everyone in it has acted.

When a step completes, the engine advances `currentStep` to the next step and
activates it; when the **last** step completes, the request becomes `APPROVED`.

The last step of every requester‑built flow is the auto‑appended final `CLOSE`
step (`isFinal`) assigned to the requestor — they confirm (`COMPLETE`) there to
finalize, which is what drives the request to `APPROVED`.

### REQUEST_CHANGES
`REQUEST_CHANGES` is **not** terminal: the engine marks the approver's task
`DONE`, cancels any remaining `PENDING` tasks, and sets the request to
`REQUEST_CHANGES` while leaving `instance.isDone = false` (the flow pauses).
The requestor then handles it via `/revise` or `/resubmit` (see request docs).

### `act` decision flow
```
load FlowInstance (by responseId) + flow.steps.assignees + tasks
guard: instance exists, not done; find caller's PENDING task on current step (else 403)
mark task DONE (action, actedAt)

if action is REJECT or CANCEL:
    cancel all remaining PENDING tasks
    instance.isDone = true
    request.status = REJECTED (or CANCELLED)
    return

if action is REQUEST_CHANGES:
    cancel all remaining PENDING tasks
    request.status = REQUEST_CHANGES        // flow pauses, NOT done
    return

if step is SEQUENTIAL and an assignee still has no task:
    create that next assignee's task; return        // hand-off, step not done

if every assignee has a DONE task:                   // step complete
    if a next step exists: currentStep = next.order; activateStep(next)
    else: instance.isDone = true; request.status = APPROVED
else:
    return                                           // PARALLEL: waiting on others
```

### Helpers
- `activateStep(instanceId, step)` — creates tasks for the step per its mode,
  copying each assignee's `type` (duty) onto the task.
- `sortedAssignees(step)` — orders assignees by `order` (used for SEQUENTIAL
  hand‑off and completion checks).

### Tables involved
`FlowInstance` (one per request, `currentStep`, `isDone`) and `Task` (one per
assignee action: `type`, `status`, `action`, `actedAt`). The engine also updates
`FormResponse.status`.

### Verified behaviour
A flow of `step1 = SEQUENTIAL[a1, a2]` then `step2 = PARALLEL[a2, a3]` drives:
```
submit            → pending [a1]
a1 approves       → pending [a2]            (sequential hand-off)
a2 approves       → pending [a2, a3]        (step1 done → step2 parallel)
a2 approves       → pending [a3]            (parallel waits for all)
a3 approves       → APPROVED                (last step done)
```

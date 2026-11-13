import { apiFetch } from "@/lib/api/client";
import { toQuery, type Paginated } from "@/lib/api/pagination";
import type {
  RequestListFilters,
  RequestScope,
  RequestSummary,
} from "../types/request";
import type { FlowStatus, RequestDetail, TaskAction } from "../types/detail";
import type { CreateRequestInput, SubmitDraftInput } from "../types/create";
import type { RequestValue } from "@/features/forms/types/form";
import type {
  FlowSimulationResult,
  OperatonFlowStatus,
  DutyListResponse,
  SignAndApproveInput,
  ResubmitProcedureInput,
} from "../types/procedure-runtime";

/** Create a request (POST /requests) — values + optional viewers/flow. */
export function createRequest(input: CreateRequestInput): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * List requests for a scope (duty / mine / viewable) with optional server-side
 * filters (formId, status) and pagination. See be RequestController.
 */
export function listRequests(
  scope: RequestScope,
  filters: RequestListFilters = {},
): Promise<Paginated<RequestSummary>> {
  const query = toQuery({
    page: filters.page,
    limit: filters.limit,
    formId: filters.formId,
    status: filters.status,
    search: filters.search,
    createdById: filters.createdById,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    dutyStatus: filters.dutyStatus,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  });
  return apiFetch<Paginated<RequestSummary>>(`/requests/${scope}${query}`);
}

/** Full request detail incl. EAV values, documents, and approval flow. */
export function getRequest(id: string): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}`);
}

/**
 * Update a request's field values (PATCH /requests/:id). Creator-only, allowed
 * only while DRAFT (craft mode).
 */
export function updateRequest(
  id: string,
  values: RequestValue[],
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ values }),
  });
}

/** Act on the request's current approval step (POST /requests/:id/approval). */
export function actOnRequest(
  id: string,
  action: TaskAction,
  comment?: string,
): Promise<FlowStatus> {
  return apiFetch<FlowStatus>(`/requests/${id}/approval`, {
    method: "POST",
    body: JSON.stringify({ action, comment }),
  });
}

/**
 * Clone a request. `reset` → fresh DRAFT (no approvals); `reserve` → carries
 * over prior approval state. Returns the new request.
 */
export function cloneRequest(
  id: string,
  mode: "reset" | "reserve",
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}/clone-${mode}`, {
    method: "POST",
  });
}

/**
 * Revise (requestor): after an approver set the request to REQUEST_CHANGES,
 * clone it (reset|reserve) and cancel the original; returns the new active
 * request. `reset` → fresh DRAFT; `reserve` → re-opened at the change step,
 * keeping earlier approvals.
 */
export function reviseRequest(
  id: string,
  mode: "reset" | "reserve",
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}/revise`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

/** FORWARD: reassign the caller's current task to another user. */
export function forwardRequest(
  id: string,
  toUserId: string,
): Promise<FlowStatus> {
  return apiFetch<FlowStatus>(`/requests/${id}/forward`, {
    method: "POST",
    body: JSON.stringify({ toUserId }),
  });
}

/**
 * Submit a DRAFT request (requestor): (re)build its approval flow + viewers and
 * start it. Used to finalize a cloned draft after editing.
 */
export function submitDraft(
  id: string,
  input: SubmitDraftInput,
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}/submit`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Cancel a request directly (requestor), independent of the flow. */
export function cancelRequest(id: string): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}/cancel`, { method: "POST" });
}

/** Pull one's own PENDING request back for changes (requestor). */
export function requestChangesSelf(id: string): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}/request-changes`, {
    method: "POST",
  });
}

/**
 * Add viewers to a request's viewable list (POST /requests/:id/viewers). The
 * requestor may add anyone; an approval assignee may share by adding viewers.
 */
export function addRequestViewers(
  id: string,
  userIds: string[],
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}/viewers`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });
}

/** Remove a viewer from the viewable list (DELETE /requests/:id/viewers/:userId). Requestor only. */
export function removeRequestViewer(
  id: string,
  userId: string,
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${id}/viewers/${userId}`, {
    method: "DELETE",
  });
}

/** Clone lineage (ancestor chain) of a request, oldest → newest. */
export function getRequestHistory(id: string): Promise<RequestSummary[]> {
  return apiFetch<RequestSummary[]>(`/requests/${id}/history`);
}

// ═════════════════════════════════════════════════════════════════════
// Phase 5: Operaton Runtime, Dynamic Flow Simulation & PDF Signing
// ═════════════════════════════════════════════════════════════════════

/** Create a draft request pinned to a published Procedure (REQ-RUN-01, ADR-005). */
export function createRequestFromProcedure(input: {
  procedureId?: string;
  procedureVersionId?: string;
}): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/from-procedure`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Simulate BPMN execution branches and stage progression (REQ-RUN-01). */
export function previewFlow(
  requestId: string,
  values: Record<string, any> = {},
): Promise<FlowSimulationResult> {
  return apiFetch<FlowSimulationResult>(`/requests/${requestId}/preview-flow`, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

/** Override actual actors on tasks where allowOverride is true (REQ-RUN-02, ADR-003). */
export function updateActualActors(
  requestId: string,
  actors: Array<{ taskDefinitionKey: string; userId: string }>,
): Promise<{ success: boolean; updatedCount: number }> {
  return apiFetch<{ success: boolean; updatedCount: number }>(
    `/requests/${requestId}/actual-actors`,
    {
      method: "PUT",
      body: JSON.stringify({ actors }),
    },
  );
}

/** Submit procedure draft request, starting Operaton process instance. */
export function submitProcedureRequest(
  requestId: string,
  values?: Record<string, any>,
): Promise<any> {
  return apiFetch<any>(`/requests/${requestId}/submit`, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

/** Get live BPMN execution status, active token and comment history (REQ-RUN-01, REQ-RUN-04). */
export function getFlowStatus(requestId: string): Promise<OperatonFlowStatus> {
  return apiFetch<OperatonFlowStatus>(`/requests/${requestId}/flow-status`);
}

/** Get high-speed projected duties for the current user (/requests/duty). */
export function getMyDuties(filters: {
  tab?: "pending" | "completed";
  search?: string;
  procedureId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<DutyListResponse> {
  const query = toQuery(filters);
  return apiFetch<DutyListResponse>(`/requests/duty${query}`);
}

/** Standard approve task on Operaton (REQ-RUN-03, REQ-RUN-04). */
export function approveOperatonTask(
  requestId: string,
  taskId: string,
  comment?: string,
): Promise<{ success: boolean; status: string; message: string }> {
  return apiFetch<{ success: boolean; status: string; message: string }>(
    `/requests/${requestId}/tasks/${taskId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ comment }),
    },
  );
}

/** Stamp PDF signature and approve task atomically (REQ-RUN-03). */
export function signAndApproveOperatonTask(
  requestId: string,
  taskId: string,
  payload: SignAndApproveInput,
): Promise<{ success: boolean; status: string; message: string }> {
  return apiFetch<{ success: boolean; status: string; message: string }>(
    `/requests/${requestId}/tasks/${taskId}/sign-and-approve`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/** Reject task and cancel Operaton instance (REQ-RUN-04). */
export function rejectOperatonTask(
  requestId: string,
  taskId: string,
  comment?: string,
): Promise<{ success: boolean; status: string; message: string }> {
  return apiFetch<{ success: boolean; status: string; message: string }>(
    `/requests/${requestId}/tasks/${taskId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ comment }),
    },
  );
}

/** Request changes from requester (REQ-RUN-04). */
export function requestChangesOperatonTask(
  requestId: string,
  taskId: string,
  comment?: string,
): Promise<{ success: boolean; status: string; message: string }> {
  return apiFetch<{ success: boolean; status: string; message: string }>(
    `/requests/${requestId}/tasks/${taskId}/request-changes`,
    {
      method: "POST",
      body: JSON.stringify({ comment }),
    },
  );
}

/** Resubmit request with updated form values after changes were requested (REQ-RUN-04). */
export function resubmitProcedureRequest(
  requestId: string,
  payload: ResubmitProcedureInput,
): Promise<{ success: boolean; status: string; message: string }> {
  return apiFetch<{ success: boolean; status: string; message: string }>(
    `/requests/${requestId}/resubmit`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/** Cancel a running procedure request (REQ-RUN-04). */
export function cancelProcedureRequest(
  requestId: string,
  reason?: string,
): Promise<{ success: boolean; status: string; message: string }> {
  return apiFetch<{ success: boolean; status: string; message: string }>(
    `/requests/${requestId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}

/** Clone a procedure request with reset or reserve mode (REQ-RUN-04). */
export function cloneProcedureRequest(
  requestId: string,
  mode: "reset" | "reserve",
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/requests/${requestId}/clone`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

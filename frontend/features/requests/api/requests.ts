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

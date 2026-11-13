// Mirrors be RequestSummaryDto (request/dto/request-response.dto.ts).

import type { RequestStatus } from "@/components/ui/StatusBadge";
import type { TaskAction, TaskStatus, TaskType } from "./detail";

export type { RequestStatus };

/** Which list endpoint to hit: my duties / created by me / watching. */
export type RequestScope = "duty" | "mine" | "viewable";

/** How a request was cloned from its parent (null for non-clones). */
export type CloneMode = "reset" | "reserve" | null;

export const REQUEST_STATUSES: RequestStatus[] = [
  "DRAFT",
  "PENDING",
  "REQUEST_CHANGES",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

/** One row in a request list (GET /requests/{mine,duty,viewable}). */
export type RequestSummary = {
  id: string;
  status: RequestStatus;
  formId: string;
  formName: string;
  formVersionId: string;
  version: number;
  createdById: string;
  clonedFromId: string | null;
  /** How this request was cloned from its parent (null for non-clones). */
  cloneMode?: CloneMode;
  createdAt: string;
  procedureVersionId?: string | null;
  procedure?: {
    id: string;
    code: string;
    name: string;
  } | null;
  // ── duty scope only: the caller's own task ("duty") on this request ───────
  /** The caller's task status on this request (duty list only). */
  dutyStatus?: TaskStatus | null;
  /** The action the caller took on their duty (null until acted). */
  dutyAction?: TaskAction | null;
  /** The duty kind — APPROVAL or ACTION. */
  dutyType?: TaskType | null;
  /** When the caller's duty was created (the action was assigned). */
  dutyCreatedAt?: string | null;
  /** When the caller acted on their duty (null until acted). */
  dutyActedAt?: string | null;
};

/** Duty list filter: only-pending, only-done, or all (undefined). */
export type DutyStatusFilter = "PENDING" | "DONE";

/** Sort keys for the duty list (mirrors be DUTY_SORT_FIELDS). */
export type DutySortField =
  | "dutyCreated"
  | "dutyActed"
  | "requestCreated"
  | "requestStatus"
  | "formName";

export const DUTY_SORT_FIELDS: DutySortField[] = [
  "dutyCreated",
  "dutyActed",
  "requestCreated",
  "requestStatus",
  "formName",
];

export type SortDir = "asc" | "desc";

/** Server-side filters supported by the request list endpoints. */
export type RequestListFilters = {
  formId?: string;
  status?: RequestStatus;
  /** Free-text: matches request id, form name, creator name/email. */
  search?: string;
  /** Filter by creator user id (ignored on the "mine" scope). */
  createdById?: string;
  /** ISO date (inclusive) lower/upper bounds on createdAt. */
  createdFrom?: string;
  createdTo?: string;
  /** Duty scope: filter by whether the caller has acted. */
  dutyStatus?: DutyStatusFilter;
  /** Duty scope: sort key + direction. */
  sortBy?: DutySortField;
  sortDir?: SortDir;
  page?: number;
  limit?: number;
};

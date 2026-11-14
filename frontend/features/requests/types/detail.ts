// Mirrors be RequestDetailDto + FlowStatusDto (request / approval-flow DTOs).

import type { RequestStatus, RequestSummary } from "./request";
import type { RequestActualActorItem } from "./procedure-runtime";

export type TaskAction =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "FORWARD"
  | "COMPLETE"
  | "CANCEL";

export type TaskStatus = "PENDING" | "DONE" | "CANCELLED";
export type TaskType = "APPROVAL" | "ACTION" | "CLOSE";
export type FlowMode = "SEQUENTIAL" | "PARALLEL";

export type FlowTaskAssignee = {
  id: string;
  email: string;
  displayName: string | null;
};

export type FlowTask = {
  id: string;
  stepOrder: number;
  stepMode: FlowMode;
  assignee: FlowTaskAssignee;
  type: TaskType;
  status: TaskStatus;
  action: TaskAction | null;
  actedAt: string | null;
};

/** One assignee in the flow blueprint, merged with their task state. */
export type FlowStepAssignee = {
  id: string;
  email: string;
  displayName: string | null;
  type: TaskType;
  order: number | null;
  /** null when this assignee has no task yet (step not reached). */
  status: TaskStatus | null;
  action: TaskAction | null;
  actedAt: string | null;
};

/** A planned step of the flow (every step + assignee, regardless of activation). */
export type FlowStepStatus = {
  order: number;
  mode: FlowMode;
  /** Optional creator-given label, shown under "Step N". */
  name: string | null;
  /** The final step: completing it (its approver signs/approves) closes the request. */
  isFinal: boolean;
  /** Whether this step must be completed for the request to close. */
  required: boolean;
  isCurrent: boolean;
  assignees: FlowStepAssignee[];
};

export type FlowStatus = {
  requestId: string;
  requestStatus: RequestStatus;
  /** false when the request has no approval flow (auto-approved). */
  hasFlow: boolean;
  isDone: boolean;
  /** `order` of the active step, or null when finished / no flow. */
  currentStep: number | null;
  /** Activated tasks (drives "can I act"). */
  tasks: FlowTask[];
  /** Full planned flow (drives the visualization). */
  steps: FlowStepStatus[];
};

export type RequestValueView = {
  fieldKey: string;
  value: unknown;
};

/** Which section an attached document occupies within the request. */
export type RequestDocSection = "MAIN" | "SECONDARY";

/** One attached document with its section + signing role. */
export type RequestDocumentView = {
  documentId: string;
  section: RequestDocSection;
  signing: boolean;
};

/** Full request detail (GET /requests/:id). */
export type RequestDetail = RequestSummary & {
  values: RequestValueView[];
  viewerIds: string[];
  documentIds: string[];
  /** Attached documents with their section + signing role. */
  documents: RequestDocumentView[];
  /** The document designated for online signing, if any. */
  signatureDocumentId: string | null;
  flow: FlowStatus;
  actualActors?: RequestActualActorItem[];
  projectedTasks?: any[];
  signatureFields?: any[];
  formVersion?: {
    id: string;
    formId?: string;
    version?: number;
    layoutSchema?: any;
  };
};

export type StepState =
  | "pending"
  | "active"
  | "done"
  | "changes"
  | "rejected"
  | "cancelled";

/** A blueprint step with a derived display state, for the visualization. */
export type FlowStepWithState = FlowStepStatus & { state: StepState };

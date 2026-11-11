// Mirrors be CreateRequestDto + CreateFlowStepInput (request / approval-flow DTOs).

import type { FlowMode, FlowStepStatus, TaskType } from "./detail";
import type { RequestValue } from "@/features/forms/types/form";

export type FlowAssigneeInput = {
  userId: string;
  /** Execution order within a SEQUENTIAL step (ignored for PARALLEL). */
  order?: number;
  type?: TaskType;
};

export type CreateFlowStepInput = {
  order: number;
  mode: FlowMode;
  /** Optional creator-given label for this step. */
  name?: string;
  /** Whether this step is required to close the request (final step always is). */
  required?: boolean;
  assignees: FlowAssigneeInput[];
};

/** Body for finalizing a DRAFT request (POST /requests/:id/submit). */
export type SubmitDraftInput = {
  steps?: CreateFlowStepInput[];
  viewerIds?: string[];
  flowName?: string;
};

export type CreateRequestInput = {
  formId: string;
  values: RequestValue[];
  viewerIds?: string[];
  steps?: CreateFlowStepInput[];
  flowName?: string;
  /** Start the approval flow immediately (default true). */
  submit?: boolean;
};

// ── Builder drafts (local wizard state) ──────────────────────────────────

/**
 * One stage in the flow builder; assignee order = position in `userIds`.
 * Exactly one draft is `required` — the final step that closes the request.
 * The builder keeps the required step last; optional steps come before it.
 */
export type FlowStepDraft = {
  mode: FlowMode;
  userIds: string[];
  /** Optional creator-given label for this step. */
  name?: string;
  /** The required final step (closes the request). Always the last draft. */
  required?: boolean;
};

/**
 * A fresh builder state: a single required final step (no approvers yet). The
 * final step is always present and is the one whose approval closes the request.
 */
export function initialFlowDrafts(): FlowStepDraft[] {
  return [{ mode: "SEQUENTIAL", userIds: [], required: true }];
}

/**
 * Seed builder drafts from an existing flow blueprint (e.g. the parent of a
 * cloned draft). Legacy requestor "close" steps (CLOSE assignees) are dropped,
 * and the last remaining step is normalized to the required final step.
 * Assignees are ordered by their execution `order`.
 */
export function fromFlowSteps(steps: FlowStepStatus[]): FlowStepDraft[] {
  const drafts = steps
    .filter((s) => !s.assignees.some((a) => a.type === "CLOSE"))
    .map((s) => ({
      mode: s.mode,
      name: s.name ?? undefined,
      required: false,
      userIds: [...s.assignees]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.id),
    }));
  if (drafts.length === 0) return initialFlowDrafts();
  // Force the last step to be the required final step.
  return drafts.map((d, i) => ({ ...d, required: i === drafts.length - 1 }));
}

/**
 * Map builder drafts to the API's step inputs: optional steps first (in order),
 * then the required final step last. Empty steps (no approvers) are dropped.
 */
export function toCreateSteps(
  drafts: FlowStepDraft[],
): CreateFlowStepInput[] {
  const optional = drafts.filter((s) => !s.required);
  const finalStep = drafts.find((s) => s.required);
  const ordered = [...optional, ...(finalStep ? [finalStep] : [])];
  return ordered
    .filter((s) => s.userIds.length > 0)
    .map((step, i) => ({
      order: i + 1,
      mode: step.mode,
      name: step.name?.trim() ? step.name.trim() : undefined,
      required: step.required ?? false,
      assignees: step.userIds.map((userId, idx) => ({
        userId,
        order: step.mode === "SEQUENTIAL" ? idx + 1 : undefined,
        type: "APPROVAL" as TaskType,
      })),
    }));
}

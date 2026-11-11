import type {
  FlowStatus,
  FlowStepWithState,
  FlowTask,
  StepState,
  TaskAction,
} from "../types/detail";

/** Derive a display state for each blueprint step (for the visualization). */
export function stepsWithState(flow: FlowStatus): FlowStepWithState[] {
  return flow.steps.map((step) => {
    const rejected = step.assignees.some((a) => a.action === "REJECT");
    const changes = step.assignees.some((a) => a.action === "REQUEST_CHANGES");
    const cancelled =
      !rejected && step.assignees.some((a) => a.status === "CANCELLED");
    const reached = step.assignees.some((a) => a.status !== null);
    const allDone =
      reached && step.assignees.every((a) => a.status === "DONE");

    const state: StepState = rejected
      ? "rejected"
      : changes
        ? "changes"
        : step.isCurrent
          ? "active"
          : allDone
            ? "done"
            : cancelled
              ? "cancelled"
              : "pending";

    return { ...step, state };
  });
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Badge tone for a task action (Part E: color-code by action). */
export function actionTone(action: TaskAction | null): Tone {
  switch (action) {
    case "APPROVE":
    case "COMPLETE":
      return "success";
    case "REQUEST_CHANGES":
      return "warning";
    case "REJECT":
      return "danger";
    case "FORWARD":
      return "info";
    case "CANCEL":
    default:
      return "neutral";
  }
}

/** Chip background/text classes for a task action, used in the flow panel. */
export function actionChipClasses(action: TaskAction | null): string | null {
  switch (action) {
    case "APPROVE":
    case "COMPLETE":
      return "bg-emerald-50 text-emerald-700";
    case "REQUEST_CHANGES":
      return "bg-amber-50 text-amber-700";
    case "REJECT":
      return "bg-red-50 text-red-600";
    case "FORWARD":
      return "bg-sky-50 text-sky-700";
    case "CANCEL":
    default:
      return null;
  }
}

/**
 * Whether a user is an approval assignee on the flow — i.e. appears as a
 * (non-CLOSE) assignee on any blueprint step. The final CLOSE step belongs to
 * the requestor, so it doesn't count. Drives viewer-sharing + in-flight uploads.
 */
export function isApprovalAssignee(flow: FlowStatus, userId: string): boolean {
  return flow.steps.some((step) =>
    step.assignees.some((a) => a.id === userId && a.type !== "CLOSE"),
  );
}

/** The current user's pending task on the active step, if any. */
export function myPendingTask(
  flow: FlowStatus,
  userId: string,
): FlowTask | null {
  return (
    flow.tasks.find(
      (t) =>
        t.assignee.id === userId &&
        t.status === "PENDING" &&
        t.stepOrder === flow.currentStep,
    ) ?? null
  );
}

export type AvailableActions = {
  /** My actionable pending task, or null. */
  task: FlowTask | null;
  /** Primary positive action(s): APPROVE for approvals, COMPLETE for actions. */
  primary: TaskAction[];
  canRequestChanges: boolean;
  canForward: boolean;
  canReject: boolean;
  /** Creator can cancel — but the engine still requires a pending task. */
  canCancel: boolean;
};

/**
 * Decide which approval actions the current user may take. Mirrors the engine's
 * constraint: every action requires a PENDING task on the current step.
 */
export function availableActions(
  flow: FlowStatus,
  createdById: string,
  userId: string,
): AvailableActions {
  const task = myPendingTask(flow, userId);
  if (!task) {
    return {
      task: null,
      primary: [],
      canRequestChanges: false,
      canForward: false,
      canReject: false,
      canCancel: false,
    };
  }
  const isApproval = task.type === "APPROVAL";
  const isClose = task.type === "CLOSE";
  return {
    task,
    // APPROVAL → approve; ACTION/CLOSE → complete (the requestor's close duty).
    primary: isApproval ? ["APPROVE"] : ["COMPLETE"],
    canRequestChanges: isApproval,
    // The requestor's closing step can't forward or reject — only close/cancel.
    canForward: !isClose,
    canReject: !isClose,
    canCancel: createdById === userId,
  };
}

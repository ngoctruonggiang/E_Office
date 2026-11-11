"use client";

import { useT } from "@/components/providers/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import type { TaskAction, TaskStatus, TaskType } from "../types/detail";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Tone for an acted duty, keyed by the action taken. */
const actionTone: Record<TaskAction, Tone> = {
  APPROVE: "success",
  COMPLETE: "success",
  REJECT: "danger",
  CANCEL: "danger",
  REQUEST_CHANGES: "warning",
  FORWARD: "info",
};

export type DutyStatusCellProps = {
  status?: TaskStatus | null;
  action?: TaskAction | null;
  type?: TaskType | null;
};

/**
 * Shows whether the caller's duty on a request is satisfied: a PENDING duty
 * reads as "awaiting you", a DONE duty shows the action taken (Approved /
 * Rejected / …), and a CANCELLED duty reads as voided. The duty kind
 * (Approval / Action) is shown alongside as context.
 */
export function DutyStatusCell({ status, action, type }: DutyStatusCellProps) {
  const t = useT();

  if (!status) return <span className="text-muted-foreground">—</span>;

  const typeLabel = type ? t(`taskType.${type}`) : null;

  let tone: Tone = "neutral";
  let label = t(`taskStatus.${status}`);

  if (status === "PENDING") {
    tone = "warning";
    label = t("requests.duty.notActedYet");
  } else if (status === "DONE" && action) {
    tone = actionTone[action];
    label = t(`taskAction.${action}`);
  } else if (status === "CANCELLED") {
    tone = "neutral";
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Badge tone={tone}>{label}</Badge>
      {typeLabel && (
        <span className="text-[11px] text-muted-foreground">{typeLabel}</span>
      )}
    </div>
  );
}

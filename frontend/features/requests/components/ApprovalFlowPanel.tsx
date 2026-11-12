"use client";

import { useState } from "react";
import {
  Check,
  X,
  Clock,
  Circle,
  GitBranch,
  ArrowDown,
  Ban,
  RefreshCw,
  Flag,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CommentThread } from "@/features/comments/components/CommentThread";
import { useCommentCounts } from "@/features/comments/hooks/useCommentCounts";
import { formatDateTime } from "@/lib/utils/format";
import { stepsWithState, actionTone } from "../lib/flow";
import type {
  FlowStatus,
  FlowStepAssignee,
  FlowStepWithState,
} from "../types/detail";
import { cn } from "@/lib/utils/cn";

const stateStyles: Record<
  FlowStepWithState["state"],
  { dot: string; row: string; icon: React.ReactNode }
> = {
  active: {
    dot: "bg-highlight text-highlight-foreground ring-2 ring-primary/25",
    row: "bg-surface-secondary/80",
    icon: <Clock size={12} />,
  },
  done: {
    dot: "bg-success text-white",
    row: "hover:bg-surface-secondary/60",
    icon: <Check size={12} />,
  },
  changes: {
    dot: "bg-warning text-white",
    row: "bg-warning-subtle/50",
    icon: <RefreshCw size={12} />,
  },
  rejected: {
    dot: "bg-danger text-white",
    row: "hover:bg-danger-subtle/40",
    icon: <X size={12} />,
  },
  cancelled: {
    dot: "bg-muted-foreground text-white",
    row: "hover:bg-surface-secondary/50",
    icon: <Ban size={12} />,
  },
  pending: {
    dot: "bg-surface-secondary text-muted-foreground border border-border",
    row: "hover:bg-surface-secondary/60",
    icon: <Circle size={10} />,
  },
};

function assigneeTone(status: FlowStepAssignee["status"]) {
  return status === "DONE"
    ? "success"
    : status === "CANCELLED"
      ? "neutral"
      : status === "PENDING"
        ? "warning"
        : "neutral";
}

function StepHeading({
  step,
  size,
}: {
  step: FlowStepWithState;
  size: "sm" | "lg";
}) {
  const t = useT();
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "font-medium text-foreground",
            size === "lg" ? "text-base font-semibold" : "text-sm",
          )}
        >
          {t("detail.step")} {step.order}
        </span>
        {step.name && (
          <span className="truncate text-xs text-muted-foreground">
            · {step.name}
          </span>
        )}
        {step.isFinal && (
          <Badge tone="neutral" className="text-[10px]">
            <Flag size={10} />
            {t("create.finalStepBadge")}
          </Badge>
        )}
      </div>
    </div>
  );
}

function StepActivityPopup({
  step,
  requestId,
  commentCount,
}: {
  step: FlowStepWithState;
  requestId: string;
  commentCount: number;
}) {
  const t = useT();
  const [locale] = useLocale();
  const [showComments, setShowComments] = useState(true);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <StepHeading step={step} size="lg" />
        <p className="text-xs text-muted-foreground">
          {t("detail.mode")}: {t(`flowMode.${step.mode}`)}
        </p>
      </div>

      <div className="divide-y divide-border-subtle rounded-lg border border-border">
        {step.assignees.map((a) => (
          <div key={a.id} className="px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {a.displayName ?? "Unknown User"}
              </span>
              <Badge
                tone={a.action ? actionTone(a.action) : assigneeTone(a.status)}
                dot
              >
                {a.action
                  ? t(`taskAction.${a.action}`)
                  : a.status
                    ? t(`taskStatus.${a.status}`)
                    : t("detail.notActedYet")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {a.email ?? "Unknown Email"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <span>{t(`taskType.${a.type}`)}</span>
              {a.actedAt && <span>· {formatDateTime(a.actedAt, locale)}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
        >
          {showComments ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <MessageSquare size={14} />
          {t("comments.stepThread")}
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {commentCount}
          </span>
        </button>
        {showComments && (
          <div className="mt-3">
            <CommentThread requestId={requestId} stepOrder={step.order} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Clean vertical timeline stepper visualizing the approval flow (no nested cards). */
export function ApprovalFlowPanel({ flow }: { flow: FlowStatus }) {
  const t = useT();
  const { open } = useModal();
  const { countFor } = useCommentCounts(flow.requestId);

  if (!flow.hasFlow || flow.steps.length === 0) {
    return <EmptyState compact title={t("detail.noFlow")} />;
  }

  const steps = stepsWithState(flow);

  return (
    <ol className="space-y-1">
      {steps.map((step, idx) => {
        const styles = stateStyles[step.state];
        const commentCount = countFor(step.order);
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.order} className="relative flex gap-2.5">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[19px] top-8 w-px bg-border"
              />
            )}

            <button
              type="button"
              onClick={() =>
                open(
                  <StepActivityPopup
                    step={step}
                    requestId={flow.requestId}
                    commentCount={commentCount}
                  />,
                )
              }
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-left transition-colors",
                styles.row,
              )}
            >
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  styles.dot,
                )}
              >
                {styles.icon}
              </span>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <StepHeading step={step} size="sm" />
                  <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                    {commentCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1"
                        title={t("comments.countTitle", {
                          count: commentCount,
                        })}
                      >
                        <MessageSquare size={11} />
                        {commentCount}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      {step.mode === "PARALLEL" ? (
                        <GitBranch size={11} />
                      ) : (
                        <ArrowDown size={11} />
                      )}
                      {t(`flowMode.${step.mode}`)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {step.assignees.map((a) => (
                    <Badge
                      key={a.id}
                      tone={a.action ? actionTone(a.action) : assigneeTone(a.status)}
                      dot
                      title={
                        a.action
                          ? t(`taskAction.${a.action}`)
                          : a.status
                            ? t(`taskStatus.${a.status}`)
                            : t("detail.notActedYet")
                      }
                    >
                      {a.displayName ?? a.email}
                    </Badge>
                  ))}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

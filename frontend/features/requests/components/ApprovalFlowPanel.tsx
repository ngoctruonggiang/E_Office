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
  MessageSquare
} from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CommentThread } from "@/features/comments/components/CommentThread";
import { useCommentCounts } from "@/features/comments/hooks/useCommentCounts";
import { formatDateTime } from "@/lib/utils/format";
import { stepsWithState, actionTone, actionChipClasses } from "../lib/flow";
import type {
  FlowStatus,
  FlowStepAssignee,
  FlowStepWithState
} from "../types/detail";
import { cn } from "@/lib/utils/cn";

const stateStyles: Record<
  FlowStepWithState["state"],
  { ring: string; dot: string; icon: React.ReactNode }
> = {
  active: {
    ring: "border-primary bg-accent",
    dot: "bg-primary text-primary-foreground",
    icon: <Clock size={13} />
  },
  done: {
    ring: "border-border bg-card",
    dot: "bg-emerald-500 text-white",
    icon: <Check size={13} />
  },
  changes: {
    ring: "border-amber-300 bg-amber-50/60",
    dot: "bg-amber-500 text-white",
    icon: <RefreshCw size={13} />
  },
  rejected: {
    ring: "border-destructive/30 bg-card",
    dot: "bg-destructive text-destructive-foreground",
    icon: <X size={13} />
  },
  cancelled: {
    ring: "border-border bg-card",
    dot: "bg-muted-foreground text-white",
    icon: <Ban size={13} />
  },
  pending: {
    ring: "border-border bg-card",
    dot: "bg-muted text-muted-foreground",
    icon: <Circle size={13} />
  }
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

/** A localized "Step N" + the creator's optional label / [Final] badge. */
function StepHeading({
  step,
  size
}: {
  step: FlowStepWithState;
  size: "sm" | "lg";
}) {
  const t = useT();
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-medium text-foreground",
            size === "lg" ? "text-lg font-semibold" : "text-sm"
          )}
        >
          {t("detail.step")} {step.order}
        </span>
        {step.isFinal && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Flag size={11} />
            {t("create.finalStepBadge")}
          </span>
        )}
      </div>
      {step.name && (
        <p
          className={cn(
            "truncate text-foreground/80",
            size === "lg" ? "text-sm" : "text-xs"
          )}
        >
          {step.name}
        </p>
      )}
    </div>
  );
}

function StepActivityPopup({
  step,
  requestId,
  commentCount
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
        <p className="text-sm text-muted-foreground">
          {t("detail.mode")}: {t(`flowMode.${step.mode}`)}
        </p>
      </div>

      <div className="space-y-2">
        {step.assignees.map((a) => (
          <div
            key={a.id}
            className="rounded-md border border-border px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {t("detail.name")}: {a.displayName ?? "Unknown User (error)"}
              </span>

              <Badge
                tone={a.action ? actionTone(a.action) : assigneeTone(a.status)}
              >
                {a.action
                  ? t(`taskAction.${a.action}`)
                  : a.status
                    ? t(`taskStatus.${a.status}`)
                    : t("detail.notActedYet")}
              </Badge>
            </div>
            <span className="text-sm font-medium text-foreground">
              {t("detail.email")}: {a.email ?? "Unknown Email (error)"}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{t(`taskType.${a.type}`)}</span>
              {a.action && <span>· {t(`taskStatus.${a.status}`)}</span>}
              {a.actedAt && <span>· {formatDateTime(a.actedAt, locale)}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Collapsible step thread — an approver's note before/after acting. */}
      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex w-full items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
        >
          {showComments ? (
            <ChevronDown size={15} />
          ) : (
            <ChevronRight size={15} />
          )}
          <MessageSquare size={14} />
          {t("comments.stepThread")}
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
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

/** Right-rail vertical stepper visualizing the full planned approval flow. */
export function ApprovalFlowPanel({ flow }: { flow: FlowStatus }) {
  const t = useT();
  const { open } = useModal();
  const { countFor } = useCommentCounts(flow.requestId);

  if (!flow.hasFlow || flow.steps.length === 0) {
    return <EmptyState title={t("detail.noFlow")} />;
  }

  const steps = stepsWithState(flow);

  return (
    <ol className="space-y-1">
      {steps.map((step, idx) => {
        const styles = stateStyles[step.state];
        const commentCount = countFor(step.order);
        return (
          <li key={step.order}>
            <button
              type="button"
              onClick={() =>
                open(
                  <StepActivityPopup
                    step={step}
                    requestId={flow.requestId}
                    commentCount={commentCount}
                  />
                )
              }
              className={cn(
                "flex-col w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/40",
                styles.ring
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                  styles.dot
                )}
              >
                {styles.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <StepHeading step={step} size="sm" />
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                      title={t("comments.countTitle", {
                        count: commentCount
                      })}
                    >
                      <MessageSquare size={12} />
                      {commentCount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      {step.mode === "PARALLEL" ? (
                        <GitBranch size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )}
                      {t(`flowMode.${step.mode}`)}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {step.assignees.map((a) => (
                    <span
                      key={a.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
                        actionChipClasses(a.action) ??
                          (a.status === "PENDING"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-muted text-muted-foreground")
                      )}
                      title={
                        a.action
                          ? t(`taskAction.${a.action}`)
                          : a.status
                            ? t(`taskStatus.${a.status}`)
                            : t("detail.notActedYet")
                      }
                    >
                      {a.displayName ?? a.email}
                    </span>
                  ))}
                </div>
              </div>
            </button>
            {idx < steps.length - 1 && (
              <div className="ml-6 h-2 w-px bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type NoticeKind = "info" | "warning" | "danger" | "success";

const styles: Record<
  NoticeKind,
  { wrap: string; icon: string; Icon: typeof Info }
> = {
  info: {
    wrap: "border-info-border bg-info-subtle text-foreground",
    icon: "text-info",
    Icon: Info,
  },
  warning: {
    wrap: "border-warning-border bg-warning-subtle text-foreground",
    icon: "text-warning",
    Icon: AlertTriangle,
  },
  danger: {
    wrap: "border-danger-border bg-danger-subtle text-foreground",
    icon: "text-danger",
    Icon: AlertCircle,
  },
  success: {
    wrap: "border-success-border bg-success-subtle text-foreground",
    icon: "text-success",
    Icon: CheckCircle2,
  },
};

export type InlineNoticeProps = {
  kind?: NoticeKind;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Contextual inline warning/error/info block placed near affected content. */
export function InlineNotice({
  kind = "info",
  title,
  description,
  action,
  className,
}: InlineNoticeProps) {
  const { wrap, icon, Icon } = styles[kind];
  return (
    <div
      role={kind === "danger" || kind === "warning" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm",
        wrap,
        className,
      )}
    >
      <Icon size={16} className={cn("mt-0.5 shrink-0", icon)} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}


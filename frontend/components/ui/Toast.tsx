"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import type { AppNotification, NotificationKind } from "@/types/notification";
import { cn } from "@/lib/utils/cn";

const kindStyles: Record<
  NotificationKind,
  { border: string; iconColor: string; Icon: typeof Info }
> = {
  info: {
    border: "border-info-border",
    iconColor: "text-info",
    Icon: Info,
  },
  success: {
    border: "border-success-border",
    iconColor: "text-success",
    Icon: CheckCircle2,
  },
  warning: {
    border: "border-warning-border",
    iconColor: "text-warning",
    Icon: AlertTriangle,
  },
  error: {
    border: "border-danger-border",
    iconColor: "text-danger",
    Icon: AlertCircle,
  },
};

/** Concise contextual toast card with semantic icon and restrained elevation. */
export function ToastCard({
  notification,
  onClose,
}: {
  notification: AppNotification;
  onClose: () => void;
}) {
  const { border, iconColor, Icon } = kindStyles[notification.kind];

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-surface p-3 shadow-lg",
        border,
      )}
    >
      <Icon size={16} className={cn("mt-0.5 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {notification.title}
        </p>
        {notification.message && (
          <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">
            {notification.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
  );
}

"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-border-subtle bg-surface-secondary text-muted-foreground",
  info: "border-info-border bg-info-subtle text-info",
  success: "border-success-border bg-success-subtle text-success",
  warning: "border-warning-border bg-warning-subtle text-warning",
  danger: "border-danger-border bg-danger-subtle text-danger",
};

const dots: Record<Tone, string> = {
  neutral: "bg-muted-foreground/70",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
};

/** Compact semantic badge with soft surface tint and subtle boundary. */
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

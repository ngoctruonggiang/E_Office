"use client";

import { cn } from "@/lib/utils/cn";

export function Spinner({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      role="status"
      aria-label="loading"
      style={{ width: size, height: size }}
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-r-transparent text-primary",
        className,
      )}
    />
  );
}

/** Centered spinner for full-panel / full-page loading states. */
export function LoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center py-14 text-muted-foreground",
        className,
      )}
    >
      <Spinner />
    </div>
  );
}

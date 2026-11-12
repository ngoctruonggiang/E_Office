"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type TabItem = {
  value: string;
  label: ReactNode;
  badge?: ReactNode;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

/** Restrained underline tab bar (controlled). */
export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-1 border-b border-border", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onValueChange(item.value)}
            className={cn(
              "relative -mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3.5 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent font-normal text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums leading-none",
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-secondary text-muted-foreground",
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

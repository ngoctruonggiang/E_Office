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

/** Underline tab bar (controlled). */
export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return <></>
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
              "relative -mb-px flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
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

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ActionMenuItem = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  dividerBefore?: boolean;
};

export type ActionMenuProps = {
  items: ActionMenuItem[];
  label?: string;
  align?: "left" | "right";
  className?: string;
};

/**
 * Compact overflow menu (`...`) for row-level and secondary contextual actions
 * (Design Rules 1.4 & 5.4).
 */
export function ActionMenu({
  items,
  label = "Actions",
  align = "right",
  className,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-secondary hover:text-foreground"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <div key={item.id}>
              {item.dividerBefore && (
                <div className="my-1 border-t border-border-subtle" />
              )}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
                  item.tone === "danger"
                    ? "text-danger hover:bg-danger-subtle"
                    : "text-foreground/90 hover:bg-surface-secondary hover:text-foreground",
                )}
              >
                {item.icon && (
                  <span className="shrink-0 text-current opacity-80">
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


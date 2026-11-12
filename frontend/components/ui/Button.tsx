"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant =
  | "primary"
  | "accent"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-solid";
type Size = "xs" | "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Show a spinner and disable the button. */
  loading?: boolean;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  accent:
    "bg-highlight text-highlight-foreground hover:bg-highlight-hover font-semibold",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline:
    "border border-border bg-surface text-foreground hover:bg-surface-secondary",
  ghost:
    "text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
  danger:
    "border border-danger-border bg-danger-subtle text-danger hover:bg-danger/15",
  "danger-solid":
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
  icon: "h-8 w-8 justify-center",
};

/** Restrained enterprise action button with selective GAFOOD lime-gold accent support. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      {children}
    </button>
  ),
);

Button.displayName = "Button";

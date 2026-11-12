"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

const baseControl =
  "w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors hover:border-foreground/25 focus:border-primary focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("h-9", baseControl, className)} {...props} />
  ),
);
Input.displayName = "Input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(baseControl, "min-h-20 resize-y", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { baseControl };

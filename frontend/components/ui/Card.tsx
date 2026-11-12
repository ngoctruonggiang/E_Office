"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "bordered" | "muted" | "flat";
};

const cardVariants: Record<NonNullable<CardProps["variant"]>, string> = {
  bordered: "rounded-lg border border-border bg-card text-card-foreground",
  muted: "rounded-lg border border-border-subtle bg-surface-secondary text-card-foreground",
  flat: "bg-card text-card-foreground",
};

/** Clean flat container with subtle hairline borders and zero heavy drop shadows. */
export function Card({ className, variant = "bordered", ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

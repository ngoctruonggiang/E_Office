"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  /** Optional secondary navigation (e.g. Tabs) placed directly below heading. */
  children?: ReactNode;
  className?: string;
};

/**
 * Standard page heading area (RAMP Section 2.4): prominent title, optional
 * short metadata/description, primary page actions near the title, and optional
 * tabs below.
 */
export function PageHeader({
  title,
  description,
  meta,
  badge,
  actions,
  backHref,
  backLabel,
  onBack,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)}>
      {(backHref || onBack) && (
        <div>
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft size={14} />
              {backLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft size={14} />
              {backLabel}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {meta && (
            <div className="text-xs text-muted-foreground">{meta}</div>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {children}
    </header>
  );
}


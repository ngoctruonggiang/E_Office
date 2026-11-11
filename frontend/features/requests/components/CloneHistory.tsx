"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, History } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime, shortId } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { getRequestHistory } from "../api/requests";
import type { RequestSummary } from "../types/request";

/**
 * Compact, collapsible clone lineage shown atop the approval flow. Lists the
 * previous versions of a request (oldest → newest) so the requestor and
 * approvers can see what was cloned and open old versions read-only. Renders
 * nothing when the request has no clone history.
 */
export function CloneHistory({
  requestId,
  currentId,
}: {
  requestId: string;
  currentId: string;
}) {
  const t = useT();
  const [locale] = useLocale();
  const [chain, setChain] = useState<RequestSummary[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getRequestHistory(requestId)
      .then((c) => active && setChain(c))
      .catch(() => active && setChain([]));
    return () => {
      active = false;
    };
  }, [requestId]);

  // No history unless this request descends from at least one other.
  if (chain.length <= 1) return null;

  return (
    <div className="mb-3 rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <History size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {t("history.title")}
        </span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">
          {chain.length}
        </span>
        <ChevronDown
          size={15}
          className={cn(
            "ml-auto text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ol className="space-y-1 border-t border-border px-3 py-2">
          {chain.map((r, idx) => {
            const isCurrent = r.id === currentId;
            const isOriginal = idx === 0;
            const label = (
              <span className="font-mono text-foreground">{shortId(r.id)}</span>
            );
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
              >
                {isCurrent ? (
                  label
                ) : (
                  <Link
                    href={`/requests/${r.id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {shortId(r.id)}
                  </Link>
                )}
                {isOriginal && (
                  <span className="text-muted-foreground">
                    ({t("history.original")})
                  </span>
                )}
                {isCurrent && (
                  <span className="text-muted-foreground">
                    ({t("history.current")})
                  </span>
                )}
                <StatusBadge status={r.status} />
                {r.cloneMode && (
                  <span className="text-muted-foreground">
                    · {t(`cloneMode.${r.cloneMode}`)}
                  </span>
                )}
                <span className="ml-auto text-muted-foreground">
                  {formatDateTime(r.createdAt, locale)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

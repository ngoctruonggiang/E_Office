"use client";

import { useEffect, useState } from "react";
import { listCommentCounts } from "../api/comments";

/**
 * Loads a request's non-deleted comment counts grouped by step in one request,
 * and returns a `countFor(stepOrder)` lookup (pass null for the request feed).
 * Counts default to 0 for scopes with no comments.
 */
export function useCommentCounts(requestId: string) {
  const [counts, setCounts] = useState<Map<number | null, number>>(new Map());

  useEffect(() => {
    let active = true;
    listCommentCounts(requestId)
      .then((rows) => {
        if (!active) return;
        setCounts(new Map(rows.map((r) => [r.stepOrder, r.count])));
      })
      .catch(() => active && setCounts(new Map()));
    return () => {
      active = false;
    };
  }, [requestId]);

  const countFor = (stepOrder: number | null) => counts.get(stepOrder) ?? 0;
  return { countFor };
}

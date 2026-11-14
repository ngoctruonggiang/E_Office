"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listComments } from "../api/comments";
import type { Comment } from "../types/comment";

/**
 * Loads a request's comment thread (request feed when `stepOrder` is omitted, or
 * a step thread otherwise). Auto-refreshes periodically and on window focus so
 * discussions stay interactive in real-time across multiple users.
 */
export function useComments(requestId: string, stepOrder?: number) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isFirstLoad = useRef(true);

  const fetchComments = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const items = await listComments(requestId, stepOrder);
        setComments(items);
        setError(null);
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [requestId, stepOrder],
  );

  const reload = useCallback(() => {
    return fetchComments(false);
  }, [fetchComments]);

  // Initial load
  useEffect(() => {
    let active = true;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      fetchComments(true);
    } else {
      fetchComments(false);
    }

    // Auto-poll comments every 4 seconds for lively interactive chat
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchComments(false);
      }
    }, 4000);

    // Refresh immediately when user focuses back on the tab
    const onFocus = () => {
      fetchComments(false);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchComments]);

  return { comments, loading, error, reload };
}

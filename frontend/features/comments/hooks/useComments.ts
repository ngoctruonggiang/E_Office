"use client";

import { useCallback, useEffect, useState } from "react";
import { listComments } from "../api/comments";
import type { Comment } from "../types/comment";

/**
 * Loads a request's comment thread (request feed when `stepOrder` is omitted, or
 * a step thread otherwise). `reload()` re-fetches after posting/liking/deleting.
 */
export function useComments(requestId: string, stepOrder?: number) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    return listComments(requestId, stepOrder)
      .then((items) => {
        setComments(items);
        setError(null);
      })
      .catch((err: Error) => setError(err));
  }, [requestId, stepOrder]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listComments(requestId, stepOrder)
      .then((items) => active && setComments(items))
      .catch((err: Error) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [requestId, stepOrder]);

  return { comments, loading, error, reload };
}

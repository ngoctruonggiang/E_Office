"use client";

import { useCallback, useEffect, useState } from "react";
import { getRequest } from "../api/requests";
import type { RequestDetail } from "../types/detail";

type State = {
  detail: RequestDetail | null;
  loading: boolean;
  error: Error | null;
};

/** Loads a single request's full detail; `reload()` re-fetches after actions. */
export function useRequestDetail(id: string) {
  const [state, setState] = useState<State>({
    detail: null,
    loading: true,
    error: null,
  });

  const load = useCallback(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getRequest(id)
      .then((detail) => active && setState({ detail, loading: false, error: null }))
      .catch(
        (error: Error) =>
          active && setState({ detail: null, loading: false, error }),
      );
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => load(), [load]);

  const reload = useCallback(() => {
    getRequest(id)
      .then((detail) => setState((s) => ({ ...s, detail })))
      .catch(() => {
        /* keep showing the last good detail on a refresh error */
      });
  }, [id]);

  return { ...state, reload };
}

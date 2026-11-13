"use client";

import { useEffect, useState } from "react";
import { getForm, getFormVersion } from "../api/forms";
import type { FormDetail } from "../types/form";

type State = {
  form: FormDetail | null;
  loading: boolean;
  error: Error | null;
};

type FetchedEntry = {
  key: string;
  form: FormDetail | null;
  error: Error | null;
};

function useAsyncFormLoader(
  key: string,
  fetcher: (k: string) => Promise<FormDetail>,
): State {
  const [fetched, setFetched] = useState<FetchedEntry | null>(null);

  useEffect(() => {
    if (!key) return;
    let active = true;

    fetcher(key)
      .then((form) => {
        if (active) setFetched({ key, form, error: null });
      })
      .catch((error: Error) => {
        if (active) setFetched({ key, form: null, error });
      });

    return () => {
      active = false;
    };
  }, [key, fetcher]);

  if (!key) {
    return { form: null, loading: false, error: null };
  }
  if (fetched && fetched.key === key) {
    return { form: fetched.form, loading: false, error: fetched.error };
  }
  return { form: null, loading: true, error: null };
}

/** Client-side loader for the latest version of a form (GET /forms/:id). */
export function useFormDefinition(id: string): State {
  return useAsyncFormLoader(id, getForm);
}

/**
 * Client-side loader for a pinned FormVersion (GET /forms/versions/:versionId).
 * Used by RequestFormData so historical requests keep their exact schema/layout.
 */
export function useFormVersion(versionId: string): State {
  return useAsyncFormLoader(versionId, getFormVersion);
}

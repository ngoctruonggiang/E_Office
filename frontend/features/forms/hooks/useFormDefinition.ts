"use client";

import { useEffect, useState } from "react";
import { getForm } from "../api/forms";
import type { FormDetail } from "../types/form";

type State = {
  form: FormDetail | null;
  loading: boolean;
  error: Error | null;
};

/**
 * Client-side loader for a form definition. In Server Components prefer calling
 * `getForm(id)` directly and passing the result to `<FormRenderer>`.
 */
export function useFormDefinition(id: string): State {
  const [state, setState] = useState<State>({
    form: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    // No id yet (e.g. the create wizard before a form is picked).
    if (!id) {
      setState({ form: null, loading: false, error: null });
      return;
    }

    setState({ form: null, loading: true, error: null });

    getForm(id)
      .then((form) => {
        if (active) setState({ form, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (active) setState({ form: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [id]);

  return state;
}

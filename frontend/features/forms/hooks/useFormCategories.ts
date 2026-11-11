"use client";

import { useEffect, useState } from "react";
import { listForms } from "../api/forms";
import type { FormSummary } from "../types/form";

/** Loads the list of form categories once (for filters / pickers). */
export function useFormCategories() {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listForms({ limit: 100 })
      .then((res) => active && setForms(res.items))
      .catch(() => active && setForms([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { forms, loading };
}

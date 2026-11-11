"use client";

import { useCallback, useEffect, useState } from "react";
import { listRoots } from "../api/organizations";
import type { OrgNode } from "../types/organization";

/** Loads the root companies in scope, with search + reload. */
export function useOrgRoots() {
  const [roots, setRoots] = useState<OrgNode[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    listRoots({ search: search.trim() || undefined, limit: 100 })
      .then((res) => setRoots(res.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { roots, search, setSearch, loading, error, reload };
}

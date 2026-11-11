"use client";

import { useCallback, useEffect, useState } from "react";
import { listMembers } from "../api/organizations";
import type { OrgMember, OrgRole } from "../types/organization";

export type MemberFilter = {
  search: string;
  role: OrgRole | "";
  isActive: "" | "true" | "false";
};

/**
 * Loads the members of the selected node's subtree (rolled up), with
 * search/role/active filters. Refetches when the selected node changes.
 */
export function useOrgMembers(nodeId: string) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [filter, setFilter] = useState<MemberFilter>({
    search: "",
    role: "",
    isActive: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    listMembers(nodeId, {
      search: filter.search.trim() || undefined,
      role: filter.role || undefined,
      isActive: filter.isActive === "" ? undefined : filter.isActive === "true",
      limit: 100,
    })
      .then((res) => setMembers(res.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [nodeId, filter]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { members, filter, setFilter, loading, error, reload };
}

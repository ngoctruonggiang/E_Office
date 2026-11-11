"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrg, getOrgTree } from "../api/organizations";
import type { OrgNode, OrgTreeNode } from "../types/organization";

/** Loads a root company's node + its full tree, with reload. */
export function useOrgTree(rootId: string) {
  const [root, setRoot] = useState<OrgNode | null>(null);
  const [tree, setTree] = useState<OrgTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([getOrg(rootId), getOrgTree(rootId)])
      .then(([node, t]) => {
        setRoot(node);
        setTree(t);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [rootId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { root, tree, loading, error, reload };
}

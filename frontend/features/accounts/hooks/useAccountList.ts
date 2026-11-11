"use client";

import { useCallback, useEffect, useState } from "react";
import { listUsers } from "@/features/users/api/users";
import type { UserLite } from "@/features/users/types/user";

/** Loads the account directory for the admin screen, with search + reload. */
export function useAccountList() {
  const [accounts, setAccounts] = useState<UserLite[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    const q = search.trim();
    // Backend filters by email/displayName separately; query both with the
    // same term and merge so a single box searches name OR email.
    Promise.all([
      listUsers({ limit: 100, ...(q ? { email: q } : {}) }),
      q ? listUsers({ limit: 100, displayName: q }) : Promise.resolve(null),
    ])
      .then(([byEmail, byName]) => {
        const map = new Map<string, UserLite>();
        for (const u of byEmail.items) map.set(u.id, u);
        if (byName) for (const u of byName.items) map.set(u.id, u);
        setAccounts([...map.values()]);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { accounts, search, setSearch, loading, error, reload };
}

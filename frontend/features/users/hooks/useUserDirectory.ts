"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listUsers } from "../api/users";
import type { UserLite } from "../types/user";

/**
 * Loads a directory of users once and exposes `resolveName(id)` to turn the
 * creator/assignee ids stored on requests into human-readable names. Falls back
 * to a short id when a user isn't in the loaded set.
 */
export function useUserDirectory() {
  const [byId, setById] = useState<Map<string, UserLite>>(new Map());
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    listUsers({ limit: 100 })
      .then((res) => setById(new Map(res.items.map((u) => [u.id, u]))))
      .catch(() => {
        /* directory is best-effort; rows fall back to ids */
      });
  }, []);

  const resolveName = useCallback(
    (id: string) => {
      const user = byId.get(id);
      if (!user) return `${id.slice(0, 8)}…`;
      return user.displayName ?? user.email;
    },
    [byId],
  );

  return { resolveName, users: byId };
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, X, Check } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { listUsers } from "../api/users";
import type { UserLite } from "../types/user";

export type UserPickerProps = {
  title: string;
  /** Pre-selected user ids. */
  initialSelected: string[];
  /** Users that must not be selectable (e.g. creator, cross-group members). */
  excludeIds?: string[];
  /** Limit to a single selection (e.g. FORWARD). */
  single?: boolean;
  onConfirm: (userIds: string[]) => void;
};

/**
 * Dual-list user picker popup: search on the left (available), chosen on the
 * right (selected). Open via `useModal().open(<UserPicker … />)`.
 */
export function UserPicker({
  title,
  initialSelected,
  excludeIds = [],
  single = false,
  onConfirm,
}: UserPickerProps) {
  const t = useT();
  const { close } = useModal();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    let active = true;
    listUsers({ limit: 100 })
      .then((res) => active && setUsers(res.items))
      .catch(() => active && setUsers([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const byId = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (exclude.has(u.id) || selected.includes(u.id)) return false;
      if (!q) return true;
      return (
        (u.displayName ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, search, selected, exclude]);

  const add = (id: string) =>
    setSelected((s) => (single ? [id] : [...s, id]));
  const remove = (id: string) =>
    setSelected((s) => s.filter((x) => x !== id));

  const label = (u: UserLite) => u.displayName ?? u.email;

  return (
    <div className="w-full max-w-xl space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("common.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Available */}
        <div className="rounded-lg border border-border">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("picker.available")}
          </p>
          <div className="max-h-64 overflow-y-auto p-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : available.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t("common.noData")}
              </p>
            ) : (
              available.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => add(u.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">
                      {label(u)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </span>
                  </span>
                  <Plus size={15} className="shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected */}
        <div className="rounded-lg border border-border">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("picker.selected")} ({selected.length})
          </p>
          <div className="max-h-64 overflow-y-auto p-1">
            {selected.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t("picker.empty")}
              </p>
            ) : (
              selected.map((id) => {
                const u = byId.get(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {u ? label(u) : `${id.slice(0, 8)}…`}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(id)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => {
            onConfirm(selected);
            close();
          }}
        >
          <Check size={16} />
          {t("common.confirm")}
        </Button>
      </div>
    </div>
  );
}

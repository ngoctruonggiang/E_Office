"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { listUsers } from "@/features/users/api/users";
import type { UserLite } from "@/features/users/types/user";
import { addMember } from "../api/organizations";
import type { FlatOrgNode, OrgRole } from "../types/organization";

export type AddMemberModalProps = {
  /** Flattened tree nodes for the target selector. */
  nodes: FlatOrgNode[];
  /** Pre-selected target node (the node currently open). */
  defaultNodeId: string;
  /**
   * Members currently loaded (the selected node's subtree). Used to exclude
   * only users ALREADY at the chosen target node — members pinned elsewhere
   * in the tree stay selectable so they can be moved (the backend relocates
   * them, keeping one membership per company).
   */
  currentMembers: { userId: string; organizationId: string }[];
  onSaved: () => void;
};

/** Pick users + a target node + an org role, then attach them. */
export function AddMemberModal({
  nodes,
  defaultNodeId,
  currentMembers,
  onSaved,
}: AddMemberModalProps) {
  const t = useT();
  const { close } = useModal();
  const { notify } = useNotifications();

  const [nodeId, setNodeId] = useState(defaultNodeId);
  const [role, setRole] = useState<OrgRole>("member");
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

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

  // Only users already attached to the chosen target node are off-limits.
  const exclude = useMemo(
    () =>
      new Set(
        currentMembers
          .filter((m) => m.organizationId === nodeId)
          .map((m) => m.userId),
      ),
    [currentMembers, nodeId],
  );
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

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

  const label = (u: UserLite) => u.displayName ?? u.email;

  const submit = async () => {
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        selected.map((userId) => addMember(nodeId, { userId, role })),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      if (ok > 0) notify({ title: t("staff.memberAdded"), kind: "success" });
      if (ok < selected.length) {
        notify({ title: t("staff.saveFailed"), kind: "error" });
      }
      onSaved();
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-xl space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t("staff.addMember")}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("staff.assignNode")}>
          <Select value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {`${"  ".repeat(n.depth)}${n.name}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("staff.orgRole")}>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as OrgRole)}
          >
            <option value="member">{t("staff.roleMember")}</option>
            <option value="manager">{t("staff.roleManager")}</option>
          </Select>
        </Field>
      </div>

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
                  onClick={() => setSelected((s) => [...s, u.id])}
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
                      onClick={() =>
                        setSelected((s) => s.filter((x) => x !== id))
                      }
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
        <Button variant="outline" onClick={close} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={submit}
          loading={busy}
          disabled={selected.length === 0}
        >
          <Check size={16} />
          {t("staff.addMember")}
        </Button>
      </div>
    </div>
  );
}

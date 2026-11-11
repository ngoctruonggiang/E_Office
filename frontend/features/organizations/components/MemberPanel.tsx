"use client";

import { Search, Trash2, UserPlus } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { useOrgMembers } from "../hooks/useOrgMembers";
import { removeMember, updateMember } from "../api/organizations";
import { AddMemberModal } from "./AddMemberModal";
import type { FlatOrgNode, OrgMember, OrgRole } from "../types/organization";

export type MemberPanelProps = {
  /** The selected node — its subtree members are listed (rolled up). */
  nodeId: string;
  /** Whether the selected node is a leaf (no children). */
  isLeaf: boolean;
  /** Flattened tree, for the add-member node selector. */
  nodes: FlatOrgNode[];
  canManage: boolean;
};

/**
 * Right column of the HR screen: members of the selected node's subtree.
 * Leaf selection shows the per-member status (and lets you toggle it); an
 * internal node instead shows which node each rolled-up member belongs to.
 */
export function MemberPanel({ nodeId, isLeaf, nodes, canManage }: MemberPanelProps) {
  const t = useT();
  const { open } = useModal();
  const { notify } = useNotifications();
  const { members, filter, setFilter, loading, reload } = useOrgMembers(nodeId);

  const fail = (err: unknown) =>
    notify({
      title: t("staff.saveFailed"),
      message: err instanceof ApiError ? err.message : undefined,
      kind: "error",
    });

  const openAdd = () => {
    open(
      <AddMemberModal
        nodes={nodes}
        defaultNodeId={nodeId}
        currentMembers={members}
        onSaved={reload}
      />,
      { size: "xl" },
    );
  };

  const changeRole = async (member: OrgMember, role: OrgRole) => {
    try {
      // Manage via the node the member is actually attached to.
      await updateMember(member.organizationId, member.id, { role });
      notify({ title: t("staff.memberUpdated"), kind: "success" });
      reload();
    } catch (err) {
      fail(err);
    }
  };

  const toggleActive = async (member: OrgMember) => {
    try {
      await updateMember(member.organizationId, member.id, {
        isActive: !member.isActive,
      });
      notify({ title: t("staff.memberUpdated"), kind: "success" });
      reload();
    } catch (err) {
      fail(err);
    }
  };

  const confirmRemove = (member: OrgMember) => {
    open(
      <ConfirmDialog
        title={t("staff.removeMember")}
        description={t("staff.removeMemberConfirm")}
        confirmLabel={t("staff.removeMember")}
        tone="danger"
        onConfirm={async () => {
          try {
            await removeMember(member.organizationId, member.id);
            notify({ title: t("staff.memberRemoved"), kind: "success" });
            reload();
          } catch (err) {
            fail(err);
          }
        }}
      />,
      { size: "md" },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">{t("staff.memberList")}</h2>
        {canManage && (
          <Button size="sm" onClick={openAdd}>
            <UserPlus size={15} />
            {t("staff.addMember")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="relative min-w-48 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder={t("staff.searchMembers")}
            className="pl-9"
          />
        </div>
        <Select
          value={filter.role}
          onChange={(e) =>
            setFilter({ ...filter, role: e.target.value as OrgRole | "" })
          }
          className="w-40"
        >
          <option value="">{t("staff.allRoles")}</option>
          <option value="manager">{t("staff.roleManager")}</option>
          <option value="member">{t("staff.roleMember")}</option>
        </Select>
        {isLeaf && (
          <Select
            value={filter.isActive}
            onChange={(e) =>
              setFilter({
                ...filter,
                isActive: e.target.value as "" | "true" | "false",
              })
            }
            className="w-40"
          >
            <option value="">{t("staff.allStatuses")}</option>
            <option value="true">{t("staff.statusActive")}</option>
            <option value="false">{t("staff.statusInactive")}</option>
          </Select>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : members.length === 0 ? (
          <EmptyState title={t("staff.noMembers")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("staff.displayName")}</TH>
                <TH>{t("staff.orgRole")}</TH>
                {/* Internal node → show where each rolled-up member sits. */}
                {!isLeaf && <TH>{t("staff.node")}</TH>}
                {/* Leaf node → show per-member status. */}
                {isLeaf && <TH>{t("common.status")}</TH>}
                {canManage && <TH className="text-right">{t("common.actions")}</TH>}
              </TR>
            </THead>
            <TBody>
              {members.map((member) => (
                <TR key={member.id}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {member.user.displayName ?? member.user.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {member.user.email}
                      </span>
                    </div>
                  </TD>
                  <TD>
                    {canManage ? (
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          changeRole(member, e.target.value as OrgRole)
                        }
                        className="w-36"
                      >
                        <option value="member">{t("staff.roleMember")}</option>
                        <option value="manager">{t("staff.roleManager")}</option>
                      </Select>
                    ) : (
                      <Badge tone={member.role === "manager" ? "info" : "neutral"}>
                        {member.role === "manager"
                          ? t("staff.roleManager")
                          : t("staff.roleMember")}
                      </Badge>
                    )}
                  </TD>

                  {!isLeaf && (
                    <TD>
                      <Badge tone="neutral">{member.organization.name}</Badge>
                    </TD>
                  )}

                  {isLeaf && (
                    <TD>
                      {canManage ? (
                        <Button
                          variant={member.isActive ? "ghost" : "outline"}
                          size="sm"
                          onClick={() => toggleActive(member)}
                        >
                          {member.isActive
                            ? t("staff.statusActive")
                            : t("staff.statusInactive")}
                        </Button>
                      ) : (
                        <Badge tone={member.isActive ? "success" : "neutral"}>
                          {member.isActive
                            ? t("staff.statusActive")
                            : t("staff.statusInactive")}
                        </Badge>
                      )}
                    </TD>
                  )}

                  {canManage && (
                    <TD>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmRemove(member)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

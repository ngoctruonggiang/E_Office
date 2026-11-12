"use client";

import { Power, Search, Trash2, UserPlus } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableCellStack,
} from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { useOrgMembers } from "../hooks/useOrgMembers";
import { removeMember, updateMember } from "../api/organizations";
import { AddMemberModal } from "./AddMemberModal";
import type { FlatOrgNode, OrgMember, OrgRole } from "../types/organization";

export type MemberPanelProps = {
  nodeId: string;
  isLeaf: boolean;
  nodes: FlatOrgNode[];
  canManage: boolean;
};

/**
 * Right column of the HR screen: members of the selected node's subtree.
 */
export function MemberPanel({
  nodeId,
  isLeaf,
  nodes,
  canManage,
}: MemberPanelProps) {
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
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("staff.memberList")}
        </h2>
        {canManage && (
          <Button variant="accent" size="sm" onClick={openAdd}>
            <UserPlus size={14} />
            {t("staff.addMember")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2.5">
        <div className="relative min-w-48 flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder={t("staff.searchMembers")}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select
          value={filter.role}
          onChange={(e) =>
            setFilter({ ...filter, role: e.target.value as OrgRole | "" })
          }
          className="h-8 w-36 text-xs"
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
            className="h-8 w-36 text-xs"
          >
            <option value="">{t("staff.allStatuses")}</option>
            <option value="true">{t("staff.statusActive")}</option>
            <option value="false">{t("staff.statusInactive")}</option>
          </Select>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState />
        ) : members.length === 0 ? (
          <EmptyState title={t("staff.noMembers")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("staff.displayName")}</TH>
                <TH>{t("staff.orgRole")}</TH>
                {!isLeaf && <TH>{t("staff.node")}</TH>}
                {isLeaf && <TH>{t("common.status")}</TH>}
                {canManage && (
                  <TH className="w-12 text-right">{t("common.actions")}</TH>
                )}
              </TR>
            </THead>
            <TBody>
              {members.map((member) => {
                const rowItems: ActionMenuItem[] = [];
                if (canManage && isLeaf) {
                  rowItems.push({
                    id: "toggle",
                    label: member.isActive
                      ? t("staff.deactivate")
                      : t("staff.activate"),
                    icon: <Power size={14} />,
                    onSelect: () => void toggleActive(member),
                  });
                }
                if (canManage) {
                  rowItems.push({
                    id: "remove",
                    label: t("staff.removeMember"),
                    icon: <Trash2 size={14} />,
                    tone: "danger",
                    dividerBefore: rowItems.length > 0,
                    onSelect: () => confirmRemove(member),
                  });
                }

                return (
                  <TR key={member.id}>
                    <TD>
                      <TableCellStack
                        primary={member.user.displayName ?? member.user.email}
                        secondary={member.user.email}
                      />
                    </TD>
                    <TD>
                      {canManage ? (
                        <Select
                          value={member.role}
                          onChange={(e) =>
                            changeRole(member, e.target.value as OrgRole)
                          }
                          className="h-8 w-32 text-xs"
                        >
                          <option value="member">{t("staff.roleMember")}</option>
                          <option value="manager">{t("staff.roleManager")}</option>
                        </Select>
                      ) : (
                        <Badge
                          tone={member.role === "manager" ? "info" : "neutral"}
                        >
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
                        <Badge
                          tone={member.isActive ? "success" : "neutral"}
                          dot
                        >
                          {member.isActive
                            ? t("staff.statusActive")
                            : t("staff.statusInactive")}
                        </Badge>
                      </TD>
                    )}

                    {canManage && (
                      <TD className="text-right">
                        <ActionMenu
                          label={t("common.actions")}
                          items={rowItems}
                        />
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils/cn";
import { ApiError } from "@/lib/api/client";
import { useOrgTree } from "../hooks/useOrgTree";
import { deleteOrg } from "../api/organizations";
import { flattenTree, type OrgTreeNode } from "../types/organization";
import { OrgTree } from "./OrgTree";
import { OrgNodeFormModal } from "./OrgNodeFormModal";
import { MemberPanel } from "./MemberPanel";

export type HrScreenProps = { rootId: string };

/**
 * Two-column HR screen: organization structure (left, neutral rail) +
 * members of the selected node's subtree (right, white content surface).
 */
export function HrScreen({ rootId }: HrScreenProps) {
  const t = useT();
  const router = useRouter();
  const { open } = useModal();
  const { notify } = useNotifications();
  const { root, tree, loading, error, reload } = useOrgTree(rootId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const flat = useMemo(() => (tree ? flattenTree(tree) : []), [tree]);
  const canManage = root?.canManage ?? false;

  const effectiveId =
    selectedId && flat.some((n) => n.id === selectedId)
      ? selectedId
      : (tree?.id ?? "");
  const selectedIsLeaf =
    flat.find((n) => n.id === effectiveId)?.isLeaf ?? true;

  const addChild = (parentId: string) =>
    open(
      <OrgNodeFormModal
        mode={{ kind: "createChild", parentId }}
        onSaved={reload}
      />,
      { size: "md" },
    );

  const rename = (node: OrgTreeNode) =>
    open(<OrgNodeFormModal mode={{ kind: "rename", node }} onSaved={reload} />, {
      size: "md",
    });

  const remove = (node: OrgTreeNode) => {
    const isRoot = node.parentId === null;
    open(
      <ConfirmDialog
        title={t("staff.deleteNode")}
        description={
          isRoot ? t("staff.deleteCompanyConfirm") : t("staff.deleteNodeConfirm")
        }
        confirmLabel={t("common.delete")}
        tone="danger"
        onConfirm={async () => {
          try {
            await deleteOrg(node.id);
            notify({ title: t("staff.nodeDeleted"), kind: "success" });
            if (isRoot) router.push("/staff/organizations");
            else {
              if (node.id === selectedId) setSelectedId(null);
              reload();
            }
          } catch (err) {
            notify({
              title: t("staff.saveFailed"),
              message: err instanceof ApiError ? err.message : undefined,
              kind: "error",
            });
          }
        }}
      />,
      { size: "md" },
    );
  };

  if (loading) return <LoadingState />;

  if (error || !root || !tree) {
    return <EmptyState title={t("common.error")} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/staff/organizations"
        backLabel={t("common.back")}
        title={root.name}
        actions={
          collapsed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen size={14} />
              {t("staff.showStructure")}
            </Button>
          ) : undefined
        }
      />

      <div
        className={cn(
          "grid gap-4",
          collapsed ? "lg:grid-cols-1" : "lg:grid-cols-[280px_1fr]",
        )}
      >
        {!collapsed && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface-secondary/50">
            <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("staff.structure")}
              </h2>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setCollapsed(true)}
                title={t("staff.hideStructure")}
              >
                <PanelLeftClose size={14} />
              </Button>
            </div>
            <div className="p-2">
              <OrgTree
                tree={tree}
                selectedId={effectiveId}
                onSelect={setSelectedId}
                canManage={canManage}
                onAddChild={addChild}
                onRename={rename}
                onDelete={remove}
              />
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <MemberPanel
            nodeId={effectiveId}
            isLeaf={selectedIsLeaf}
            nodes={flat}
            canManage={canManage}
          />
        </div>
      </div>
    </div>
  );
}

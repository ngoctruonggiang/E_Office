"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
 * Two-column HR screen: organization structure (left, collapsible) + the
 * members of the selected node's subtree (right). Reachable only by an admin
 * or a manager of this company, so management controls are always enabled.
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

  // Members get read-only access; managers/admins can mutate.
  const canManage = root?.canManage ?? false;

  // Selection defaults to the root and falls back to it if the selected node
  // disappears (e.g. it was just deleted).
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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error || !root || !tree) {
    return <EmptyState title={t("common.error")} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/staff/organizations"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("common.back")}
        >
          <ArrowLeft size={18} />
        </Link>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 size={18} />
        </span>
        <h1 className="flex-1 text-xl font-semibold text-foreground">
          {root.name}
        </h1>
      </div>

      <div
        className={cn(
          "grid gap-4",
          // collapsed ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(200px,360px)_1fr]",
          collapsed ? "lg:grid-cols-[max-content_1fr]" : "lg:grid-cols-[minmax(max-content,280px)_1fr]",
        )}
      >
        {
          collapsed && (<Button
          variant="outline"
          size="sm"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} />
          ) : (
            <PanelLeftClose size={15} />
          )}
          {collapsed ? t("staff.showStructure") : t("staff.hideStructure")}
        </Button> )
        }
        {/* Left: structure */}
        {!collapsed && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold text-foreground">
                {t("staff.structure")}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollapsed((c) => !c)}
              >
                {collapsed ? (
                  <PanelLeftOpen size={15} />
                ) : (
                  <PanelLeftClose size={15} />
                )}
                {collapsed ? t("staff.showStructure") : t("staff.hideStructure")}
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

        {/* Right: members of the selected node's subtree */}
        <div className="rounded-lg border border-border bg-card">
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

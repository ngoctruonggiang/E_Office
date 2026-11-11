"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { cn } from "@/lib/utils/cn";
import type { OrgTreeNode } from "../types/organization";

export type OrgTreeProps = {
  tree: OrgTreeNode;
  /** Currently selected node id (drives the member panel + highlight). */
  selectedId: string;
  onSelect: (nodeId: string) => void;
  /** Whether the current user may mutate the structure. */
  canManage: boolean;
  onAddChild: (parentId: string) => void;
  onRename: (node: OrgTreeNode) => void;
  onDelete: (node: OrgTreeNode) => void;
};

/** Folder-style organization tree: click to select, hover for node actions. */
export function OrgTree({
  tree,
  selectedId,
  onSelect,
  canManage,
  onAddChild,
  onRename,
  onDelete,
}: OrgTreeProps) {
  return (
    <div className="space-y-0.5">
      <TreeRow
        node={tree}
        depth={0}
        isRoot
        selectedId={selectedId}
        onSelect={onSelect}
        canManage={canManage}
        onAddChild={onAddChild}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  );
}

type TreeRowProps = {
  node: OrgTreeNode;
  depth: number;
  isRoot?: boolean;
  selectedId: string;
  onSelect: (nodeId: string) => void;
  canManage: boolean;
  onAddChild: (parentId: string) => void;
  onRename: (node: OrgTreeNode) => void;
  onDelete: (node: OrgTreeNode) => void;
};

function TreeRow({
  node,
  depth,
  isRoot = false,
  selectedId,
  onSelect,
  canManage,
  onAddChild,
  onRename,
  onDelete,
}: TreeRowProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const selected = node.id === selectedId;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
        className={cn(
          "group flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 outline-none",
          selected
            ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
            : "hover:bg-muted/60",
        )}
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground",
            !hasChildren && "invisible",
          )}
          aria-label={expanded ? t("common.close") : t("common.view")}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <FolderTree
          size={15}
          className={cn(
            "shrink-0",
            selected || isRoot ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            isRoot ? "font-semibold text-foreground" : "text-foreground",
          )}
        >
          {node.name}
        </span>

        {canManage && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
              title={t("staff.addChild")}
              className="rounded p-1 text-muted-foreground hover:bg-background hover:text-primary"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRename(node);
              }}
              title={t("staff.rename")}
              className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node);
              }}
              title={t("staff.deleteNode")}
              className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              canManage={canManage}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

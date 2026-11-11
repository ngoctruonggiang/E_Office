// Mirrors be organization DTOs (modules/organization/dto/*).

export type OrgNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  rootId: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  /** Members across the whole tree rooted here. Set on /roots. */
  memberCount?: number;
  /** Whether the current user may manage this company (else read-only view). */
  canManage?: boolean;
};

/** Recursive tree node returned by GET /organizations/:id/tree. */
export type OrgTreeNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  rootId: string;
  children: OrgTreeNode[];
};

export type OrgRole = "manager" | "member";

export type OrgMember = {
  id: string;
  userId: string;
  organizationId: string;
  role: OrgRole;
  isActive: boolean;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    isActive: boolean;
  };
  /** The node this member is attached to. */
  organization: { id: string; name: string };
};

/** A tree node flattened with its depth + leaf flag, for selects/lookups. */
export type FlatOrgNode = {
  id: string;
  name: string;
  depth: number;
  isLeaf: boolean;
};

/** Depth-first flatten of a tree into rows carrying depth + leaf flag. */
export function flattenTree(node: OrgTreeNode, depth = 0): FlatOrgNode[] {
  const self: FlatOrgNode = {
    id: node.id,
    name: node.name,
    depth,
    isLeaf: node.children.length === 0,
  };
  return [
    self,
    ...node.children.flatMap((child) => flattenTree(child, depth + 1)),
  ];
}

import { apiFetch } from "@/lib/api/client";
import { toQuery, type Paginated } from "@/lib/api/pagination";
import type {
  OrgMember,
  OrgNode,
  OrgRole,
  OrgTreeNode,
} from "../types/organization";

// ── Tree ─────────────────────────────────────────────────────────────────

/** Root companies in scope (admin → all; user → managed). */
export function listRoots(
  params: { search?: string; page?: number; limit?: number } = {},
): Promise<Paginated<OrgNode>> {
  return apiFetch<Paginated<OrgNode>>(`/organizations/roots${toQuery(params)}`);
}

export function getOrg(id: string): Promise<OrgNode> {
  return apiFetch<OrgNode>(`/organizations/${id}`);
}

export function getOrgTree(id: string): Promise<OrgTreeNode> {
  return apiFetch<OrgTreeNode>(`/organizations/${id}/tree`);
}

export function createOrg(input: {
  name: string;
  type?: string;
  parentId?: string;
}): Promise<OrgNode> {
  return apiFetch<OrgNode>("/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateOrg(
  id: string,
  input: { name?: string; type?: string },
): Promise<OrgNode> {
  return apiFetch<OrgNode>(`/organizations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteOrg(id: string): Promise<void> {
  return apiFetch<void>(`/organizations/${id}`, { method: "DELETE" });
}

// ── Members ────────────────────────────────────────────────────────────

/** Members of a node's whole subtree (rolled up), each carrying its node. */
export function listMembers(
  nodeId: string,
  params: {
    search?: string;
    role?: OrgRole;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {},
): Promise<Paginated<OrgMember>> {
  return apiFetch<Paginated<OrgMember>>(
    `/organizations/${nodeId}/members${toQuery(params)}`,
  );
}

/** Add an existing user to a specific node (any level). */
export function addMember(
  nodeId: string,
  input: { userId: string; role?: OrgRole },
): Promise<OrgMember> {
  return apiFetch<OrgMember>(`/organizations/${nodeId}/members`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMember(
  nodeId: string,
  memberId: string,
  input: { role?: OrgRole; isActive?: boolean },
): Promise<OrgMember> {
  return apiFetch<OrgMember>(`/organizations/${nodeId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function removeMember(nodeId: string, memberId: string): Promise<void> {
  return apiFetch<void>(`/organizations/${nodeId}/members/${memberId}`, {
    method: "DELETE",
  });
}

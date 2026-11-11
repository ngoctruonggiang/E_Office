import { ApiProperty } from '@nestjs/swagger';
import { Organization } from '@prisma/client';

/** A node with its descendants nested under `children`. */
export class OrganizationTreeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ nullable: true, type: String })
  parentId!: string | null;

  @ApiProperty()
  rootId!: string;

  @ApiProperty({ type: () => [OrganizationTreeDto] })
  children!: OrganizationTreeDto[];
}

/**
 * Build a nested tree from a flat list of nodes that all share one root.
 * Returns the subtree rooted at `rootNodeId`, or null if it is not present.
 */
export function buildTree(
  nodes: Organization[],
  rootNodeId: string,
): OrganizationTreeDto | null {
  const byId = new Map<string, OrganizationTreeDto>();
  for (const n of nodes) {
    byId.set(n.id, {
      id: n.id,
      name: n.name,
      type: n.type,
      parentId: n.parentId,
      rootId: n.rootId,
      children: [],
    });
  }
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId) && n.id !== rootNodeId) {
      byId.get(n.parentId)!.children.push(byId.get(n.id)!);
    }
  }
  // Stable, name-sorted children for a predictable folder view.
  for (const node of byId.values()) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byId.get(rootNodeId) ?? null;
}

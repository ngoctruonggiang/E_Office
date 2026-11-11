import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Organization, OrganizationMember, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';
import { buildMeta, toSkipTake } from '../../core/common/utils/pagination.util';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ListRootsQueryDto } from './dto/list-roots-query.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

/** Minimal principal the service needs for authorization. */
export type Actor = { userId: string; role: string };

type MemberWithRelations = OrganizationMember & {
  user: User;
  organization: { id: string; name: string };
};

/**
 * Owns the organization tree and its (root-scoped) membership.
 *
 * Authorization model:
 *  - System "admin" can do anything.
 *  - A System "user" can manage a root (and its whole subtree) only when they
 *    hold an ACTIVE `manager` membership somewhere within that root's tree.
 * Membership is PER-NODE (organizationId is any node) and rolls up to ancestors:
 * a member of a leaf is implicitly a member of every node above it.
 */
@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Authorization helpers ───────────────────────────────────────────────

  private isAdmin(actor: Actor): boolean {
    return actor.role === 'admin';
  }

  /**
   * True when the actor may MANAGE `rootId`'s tree: an admin, or an active
   * `manager` of any node inside it (a manager runs the whole company).
   */
  async canManageRoot(actor: Actor, rootId: string): Promise<boolean> {
    if (this.isAdmin(actor)) return true;
    const managing = await this.prisma.organizationMember.findFirst({
      where: {
        userId: actor.userId,
        role: 'manager',
        isActive: true,
        organization: { rootId },
      },
      select: { id: true },
    });
    return Boolean(managing);
  }

  /** Throws unless the actor may manage `rootId`'s tree. */
  private async assertCanManageRoot(
    actor: Actor,
    rootId: string,
  ): Promise<void> {
    if (!(await this.canManageRoot(actor, rootId))) {
      throw new ForbiddenException('You do not manage this organization.');
    }
  }

  /**
   * Throws unless the actor may VIEW `rootId`'s tree: an admin, or ANY active
   * member (manager or member) of a node inside it. View is read-only — the
   * mutating methods still require `assertCanManageRoot`.
   */
  private async assertCanViewRoot(actor: Actor, rootId: string): Promise<void> {
    if (this.isAdmin(actor)) return;
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId: actor.userId, isActive: true, organization: { rootId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this organization.');
    }
  }

  private async getNodeOrThrow(id: string): Promise<Organization> {
    const node = await this.prisma.organization.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('Organization not found');
    return node;
  }

  /** Ids of `node` plus every descendant (its whole subtree). */
  private async subtreeNodeIds(node: Organization): Promise<string[]> {
    const all = await this.prisma.organization.findMany({
      where: { rootId: node.rootId },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const n of all) {
      if (!n.parentId) continue;
      const arr = childrenByParent.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenByParent.set(n.parentId, arr);
    }
    const ids: string[] = [];
    const stack = [node.id];
    while (stack.length) {
      const id = stack.pop()!;
      ids.push(id);
      const kids = childrenByParent.get(id);
      if (kids) stack.push(...kids);
    }
    return ids;
  }

  // ── Tree CRUD ────────────────────────────────────────────────────────────

  async createNode(
    dto: CreateOrganizationDto,
    actor: Actor,
  ): Promise<Organization> {
    const type = dto.type ?? 'company';

    if (!dto.parentId) {
      // Root creation — admins only.
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException(
          'Only admins can create root organizations.',
        );
      }
      const id = randomUUID();
      return this.prisma.organization.create({
        data: {
          id,
          name: dto.name,
          type,
          parentId: null,
          rootId: id, // a root is its own root
          createdById: actor.userId,
        },
      });
    }

    // Child creation — admin or a manager of the parent's root.
    const parent = await this.getNodeOrThrow(dto.parentId);
    await this.assertCanManageRoot(actor, parent.rootId);
    return this.prisma.organization.create({
      data: {
        name: dto.name,
        type,
        parentId: parent.id,
        rootId: parent.rootId,
        createdById: actor.userId,
      },
    });
  }

  async getNode(id: string, actor: Actor): Promise<Organization> {
    const node = await this.getNodeOrThrow(id);
    await this.assertCanViewRoot(actor, node.rootId);
    return node;
  }

  async updateNode(
    id: string,
    dto: UpdateOrganizationDto,
    actor: Actor,
  ): Promise<Organization> {
    const node = await this.getNodeOrThrow(id);
    await this.assertCanManageRoot(actor, node.rootId);
    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    return this.prisma.organization.update({ where: { id }, data });
  }

  async deleteNode(id: string, actor: Actor): Promise<void> {
    const node = await this.getNodeOrThrow(id);

    const childCount = await this.prisma.organization.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        'Remove or move the sub-nodes before deleting this node.',
      );
    }

    if (node.parentId === null) {
      // Deleting a whole company (cascades its members) is admin-only.
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException(
          'Only admins can delete a root organization.',
        );
      }
    } else {
      await this.assertCanManageRoot(actor, node.rootId);
    }

    await this.prisma.organization.delete({ where: { id } });
  }

  /** Full subtree rooted at `id` (whole tree when `id` is a root). */
  async getTree(id: string, actor: Actor): Promise<Organization[]> {
    const node = await this.getNodeOrThrow(id);
    await this.assertCanViewRoot(actor, node.rootId);
    // Fetch the whole tree of this root in one query; the controller assembles
    // the subtree from `id` downward.
    return this.prisma.organization.findMany({
      where: { rootId: node.rootId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Root companies in the actor's scope. Admin sees all; a user sees every
   * company they BELONG to (any role) — they can view those they only belong
   * to and manage those where they are a manager (`canManage` per item).
   * `memberCount` is the WHOLE TREE's members (every node whose rootId is this
   * root), not just the root node's direct members.
   */
  async listRoots(
    actor: Actor,
    query: ListRootsQueryDto,
  ): Promise<
    Paginated<Organization & { memberCount: number; canManage: boolean }>
  > {
    const { skip, take, page, limit } = toSkipTake(query);

    const where: Prisma.OrganizationWhereInput = {
      parentId: null,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    // Roots the (non-admin) user manages — used to flag canManage per item.
    let managerRootIds = new Set<string>();
    if (!this.isAdmin(actor)) {
      const memberships = await this.prisma.organizationMember.findMany({
        where: { userId: actor.userId, isActive: true },
        select: { role: true, organization: { select: { rootId: true } } },
      });
      const visibleRootIds = [
        ...new Set(memberships.map((m) => m.organization.rootId)),
      ];
      managerRootIds = new Set(
        memberships
          .filter((m) => m.role === 'manager')
          .map((m) => m.organization.rootId),
      );
      where.id = { in: visibleRootIds };
    }

    const [rawItems, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    // Members of the whole tree = memberships on ANY node sharing this rootId.
    const counts = await Promise.all(
      rawItems.map((org) =>
        this.prisma.organizationMember.count({
          where: { organization: { rootId: org.id } },
        }),
      ),
    );

    const items = rawItems.map((org, i) => ({
      ...org,
      memberCount: counts[i],
      canManage: this.isAdmin(actor) || managerRootIds.has(org.id),
    }));

    return { items, meta: buildMeta(total, page, limit) };
  }

  // ── Members (per-node, rolled up to ancestors) ─────────────────────────

  /**
   * Members of `nodeId`'s whole subtree (the node + every descendant), so a
   * member pinned to a leaf surfaces on each ancestor. Each row carries the
   * node it is actually attached to.
   */
  async listMembers(
    nodeId: string,
    actor: Actor,
    query: ListMembersQueryDto,
  ): Promise<Paginated<MemberWithRelations>> {
    const node = await this.getNodeOrThrow(nodeId);
    await this.assertCanViewRoot(actor, node.rootId);
    const { skip, take, page, limit } = toSkipTake(query);

    const subtreeIds = await this.subtreeNodeIds(node);

    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId: { in: subtreeIds },
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined
        ? { isActive: query.isActive === 'true' }
        : {}),
      ...(query.search
        ? {
            user: {
              OR: [
                { displayName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where,
        skip,
        take,
        orderBy: { joinedAt: 'asc' },
        include: { user: true, organization: { select: { id: true, name: true } } },
      }),
      this.prisma.organizationMember.count({ where }),
    ]);

    return { items, meta: buildMeta(total, page, limit) };
  }

  /**
   * Attach an existing user to a node. A user holds AT MOST ONE membership per
   * company: if they already belong elsewhere in this tree, that membership is
   * MOVED here (so adding a company member to a sub-department relocates them
   * instead of duplicating). Any stray duplicates are collapsed too.
   */
  async addMember(
    nodeId: string,
    dto: AddMemberDto,
    actor: Actor,
  ): Promise<MemberWithRelations> {
    const node = await this.getNodeOrThrow(nodeId);
    await this.assertCanManageRoot(actor, node.rootId);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Every membership this user already holds inside the same company.
    const inTree = await this.prisma.organizationMember.findMany({
      where: { userId: dto.userId, organization: { rootId: node.rootId } },
      select: { id: true, organizationId: true, role: true },
    });
    const here = inTree.find((m) => m.organizationId === nodeId);
    if (here && inTree.length === 1) {
      throw new ConflictException('User is already a member of this unit.');
    }

    const role = dto.role ?? inTree[0]?.role ?? 'member';

    return this.prisma.$transaction(async (tx) => {
      if (inTree.length) {
        await tx.organizationMember.deleteMany({
          where: { id: { in: inTree.map((m) => m.id) } },
        });
      }
      return tx.organizationMember.create({
        data: { userId: dto.userId, organizationId: nodeId, role },
        include: {
          user: true,
          organization: { select: { id: true, name: true } },
        },
      });
    });
  }

  async updateMember(
    nodeId: string,
    memberId: string,
    dto: UpdateMemberDto,
    actor: Actor,
  ): Promise<MemberWithRelations> {
    const node = await this.getNodeOrThrow(nodeId);
    await this.assertCanManageRoot(actor, node.rootId);
    await this.getMemberInRootOrThrow(node.rootId, memberId);

    const data: Prisma.OrganizationMemberUpdateInput = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data,
      include: { user: true, organization: { select: { id: true, name: true } } },
    });
  }

  async removeMember(
    nodeId: string,
    memberId: string,
    actor: Actor,
  ): Promise<void> {
    const node = await this.getNodeOrThrow(nodeId);
    await this.assertCanManageRoot(actor, node.rootId);
    await this.getMemberInRootOrThrow(node.rootId, memberId);
    await this.prisma.organizationMember.delete({ where: { id: memberId } });
  }

  /** A membership must live somewhere within the same root to be managed. */
  private async getMemberInRootOrThrow(
    rootId: string,
    memberId: string,
  ): Promise<OrganizationMember> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { organization: { select: { rootId: true } } },
    });
    if (!member || member.organization.rootId !== rootId) {
      throw new NotFoundException('Member not found in this company');
    }
    return member;
  }
}

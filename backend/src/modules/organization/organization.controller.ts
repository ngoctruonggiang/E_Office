import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import { ApiPaginatedResponse } from '../../core/common/decorators/api-paginated-response.decorator';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';
import type { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { OrganizationService, Actor } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ListRootsQueryDto } from './dto/list-roots-query.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';
import {
  OrganizationTreeDto,
  buildTree,
} from './dto/organization-tree.dto';
import { MemberResponseDto } from './dto/member-response.dto';

/**
 * Organization structure + HR (root-scoped membership). The global JwtAuthGuard
 * applies; row-level authorization (admin vs. root-manager) lives in the
 * service, so most routes carry no @Roles decorator.
 */
@ApiTags('organizations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizations: OrganizationService) {}

  private actor(user: AuthenticatedUser): Actor {
    return { userId: user.userId, role: user.role };
  }

  // ── Tree ─────────────────────────────────────────────────────────────────

  @Get('roots')
  @ApiOperation({
    summary: 'List root companies in scope (admin → all; user → managed)',
  })
  @ApiPaginatedResponse(OrganizationResponseDto)
  async listRoots(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRootsQueryDto,
  ): Promise<Paginated<OrganizationResponseDto>> {
    const { items, meta } = await this.organizations.listRoots(
      this.actor(user),
      query,
    );
    return {
      items: items.map((o) =>
        OrganizationResponseDto.fromEntity(o, {
          memberCount: o.memberCount,
          canManage: o.canManage,
        }),
      ),
      meta,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a node (root = admin only; child = admin or root-manager)',
  })
  @ApiCreatedResponse({ type: OrganizationResponseDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const node = await this.organizations.createNode(dto, this.actor(user));
    return OrganizationResponseDto.fromEntity(node);
  }

  @Get(':id/tree')
  @ApiOperation({ summary: 'Get the subtree rooted at a node' })
  @ApiOkResponse({ type: OrganizationTreeDto })
  async tree(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrganizationTreeDto> {
    const nodes = await this.organizations.getTree(id, this.actor(user));
    const tree = buildTree(nodes, id);
    if (!tree) throw new NotFoundException('Organization not found');
    return tree;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single node (with the caller\'s canManage)' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrganizationResponseDto> {
    const actor = this.actor(user);
    const node = await this.organizations.getNode(id, actor);
    const canManage = await this.organizations.canManageRoot(actor, node.rootId);
    return OrganizationResponseDto.fromEntity(node, { canManage });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename / re-type a node' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const node = await this.organizations.updateNode(id, dto, this.actor(user));
    return OrganizationResponseDto.fromEntity(node);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a node (must have no children)' })
  @ApiNoContentResponse({ description: 'Node deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.organizations.deleteNode(id, this.actor(user));
  }

  // ── Members (per-node, rolled up to ancestors) ─────────────────────────

  @Get(':nodeId/members')
  @ApiOperation({
    summary: "List a node's members (its whole subtree, rolled up)",
  })
  @ApiPaginatedResponse(MemberResponseDto)
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('nodeId') nodeId: string,
    @Query() query: ListMembersQueryDto,
  ): Promise<Paginated<MemberResponseDto>> {
    const { items, meta } = await this.organizations.listMembers(
      nodeId,
      this.actor(user),
      query,
    );
    return { items: items.map((m) => MemberResponseDto.fromEntity(m)), meta };
  }

  @Post(':nodeId/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an existing user to a node' })
  @ApiCreatedResponse({ type: MemberResponseDto })
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('nodeId') nodeId: string,
    @Body() dto: AddMemberDto,
  ): Promise<MemberResponseDto> {
    const member = await this.organizations.addMember(
      nodeId,
      dto,
      this.actor(user),
    );
    return MemberResponseDto.fromEntity(member);
  }

  @Patch(':nodeId/members/:memberId')
  @ApiOperation({ summary: "Change a member's org role or active status" })
  @ApiOkResponse({ type: MemberResponseDto })
  async updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('nodeId') nodeId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberResponseDto> {
    const member = await this.organizations.updateMember(
      nodeId,
      memberId,
      dto,
      this.actor(user),
    );
    return MemberResponseDto.fromEntity(member);
  }

  @Delete(':nodeId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from the company' })
  @ApiNoContentResponse({ description: 'Member removed.' })
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('nodeId') nodeId: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    await this.organizations.removeMember(nodeId, memberId, this.actor(user));
  }
}

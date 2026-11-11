import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Organization } from '@prisma/client';

/** Public shape of a single organization node. */
export class OrganizationResponseDto {
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

  @ApiProperty({ nullable: true, type: String })
  createdById!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({
    description:
      "Members across the whole tree rooted here (every node's members).",
  })
  memberCount?: number;

  @ApiPropertyOptional({
    description:
      'Whether the current user may manage this company (admin or a manager). ' +
      'When false the user has read-only view access.',
  })
  canManage?: boolean;

  static fromEntity(
    org: Organization,
    opts: { memberCount?: number; canManage?: boolean } = {},
  ): OrganizationResponseDto {
    return {
      id: org.id,
      name: org.name,
      type: org.type,
      parentId: org.parentId,
      rootId: org.rootId,
      createdById: org.createdById,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      ...(opts.memberCount !== undefined ? { memberCount: opts.memberCount } : {}),
      ...(opts.canManage !== undefined ? { canManage: opts.canManage } : {}),
    };
  }
}

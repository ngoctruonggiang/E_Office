import { ApiProperty } from '@nestjs/swagger';
import { OrganizationMember, User } from '@prisma/client';

/** Lite user shape embedded in a membership row. */
class MemberUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true, type: String }) displayName!: string | null;
  @ApiProperty({ description: 'System role.' }) role!: string;
  @ApiProperty() isActive!: boolean;
}

/** The node a member is actually attached to. */
class MemberNodeDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

/** A membership row joined with its user. */
export class MemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ description: 'Org role: manager | member.' })
  role!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  joinedAt!: Date;

  @ApiProperty({ type: MemberUserDto })
  user!: MemberUserDto;

  @ApiProperty({
    type: MemberNodeDto,
    description: 'The node this member is attached to.',
  })
  organization!: MemberNodeDto;

  static fromEntity(
    member: OrganizationMember & {
      user: User;
      organization: { id: string; name: string };
    },
  ): MemberResponseDto {
    return {
      id: member.id,
      userId: member.userId,
      organizationId: member.organizationId,
      role: member.role,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      user: {
        id: member.user.id,
        email: member.user.email,
        displayName: member.user.displayName,
        role: member.user.role,
        isActive: member.user.isActive,
      },
      organization: {
        id: member.organization.id,
        name: member.organization.name,
      },
    };
  }
}

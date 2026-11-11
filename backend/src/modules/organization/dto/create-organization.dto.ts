import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Create an organization node. When `parentId` is omitted the node is a ROOT
 * (a company) — only admins may create roots. With a `parentId` it is a child
 * node, creatable by an admin or by a manager of that root.
 */
export class CreateOrganizationDto {
  @ApiProperty({ example: 'ABC Group', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'company',
    description: 'company | department | group | ... (free-form).',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @ApiPropertyOptional({
    description: 'Parent node id. Omit to create a root company.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}

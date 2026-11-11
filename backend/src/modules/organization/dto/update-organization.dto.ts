import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Rename / re-type an organization node. */
export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'ABC Group', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'department', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;
}

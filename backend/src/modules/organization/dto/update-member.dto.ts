import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

/** Change a member's org role (manager/member) or active status. */
export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ['manager', 'member'] })
  @IsOptional()
  @IsIn(['manager', 'member'])
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

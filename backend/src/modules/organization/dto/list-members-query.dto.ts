import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../core/common/dto/pagination-query.dto';

/** Filters for listing a company's members, on top of pagination. */
export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive match on member display name or email.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['manager', 'member'] })
  @IsOptional()
  @IsIn(['manager', 'member'])
  role?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status ("true" | "false").',
  })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../core/common/dto/pagination-query.dto';

/** Filters for listing root companies, on top of pagination. */
export class ListRootsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive partial match on the company name.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

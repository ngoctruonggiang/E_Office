import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../core/common/dto/pagination-query.dto';

/** Optional filters + pagination for listing form categories. */
export class ListFormsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive partial match on form name.',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

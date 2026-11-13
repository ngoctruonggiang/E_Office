import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DutyQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'completed'], default: 'pending' })
  @IsOptional()
  @IsIn(['pending', 'completed'])
  tab?: 'pending' | 'completed' = 'pending';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term by requester or procedure name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by Procedure UUID' })
  @IsOptional()
  @IsString()
  procedureId?: string;
}


import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RequestStatus } from '@prisma/client';
import { DUTY_SORT_FIELDS, type DutySortField } from './list-requests-query.dto';

export class DutyQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'completed'] })
  @IsOptional()
  @IsIn(['pending', 'completed'])
  tab?: 'pending' | 'completed';

  @ApiPropertyOptional({ enum: ['PENDING', 'DONE'] })
  @IsOptional()
  @IsIn(['PENDING', 'DONE'])
  dutyStatus?: 'PENDING' | 'DONE';

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

  @ApiPropertyOptional({ description: 'Search keyword alias' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by Procedure UUID' })
  @IsOptional()
  @IsString()
  procedureId?: string;

  @ApiPropertyOptional({ description: 'Filter by Form UUID' })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ enum: DUTY_SORT_FIELDS, default: 'dutyCreated' })
  @IsOptional()
  @IsIn(DUTY_SORT_FIELDS)
  sortBy?: DutySortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Only requests created on/after this date' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Only requests created on/before this date' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ description: 'Filter by creator user ID' })
  @IsOptional()
  @IsString()
  createdById?: string;
}


import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { RequestStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../core/common/dto/pagination-query.dto';

/** Sort keys for the "duty" list (the only scope ordered by task fields). */
export const DUTY_SORT_FIELDS = [
  'dutyCreated',
  'dutyActed',
  'requestCreated',
  'requestStatus',
  'formName',
] as const;
export type DutySortField = (typeof DUTY_SORT_FIELDS)[number];

/** Optional query filters + pagination shared by the request list endpoints. */
export class ListRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter to requests of this form category (kind of form).',
  })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({
    description: 'Filter to requests with this status.',
    enum: RequestStatus,
  })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({
    description:
      'Free-text search: matches request id, form name, or creator name/email (case-insensitive).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter to requests created by this user id. Ignored on the "mine" list (always the caller).',
  })
  @IsOptional()
  @IsString()
  createdById?: string;

  @ApiPropertyOptional({
    description: 'Only requests created on/after this date (ISO 8601).',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Only requests created on/before this date (ISO 8601).',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  // ── duty-scope only ──────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Duty list only: filter by whether the caller has acted. PENDING = duty ' +
      'still owed, DONE = already acted. Omit for all. Ignored on other scopes.',
    enum: ['PENDING', 'DONE'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'DONE'])
  dutyStatus?: 'PENDING' | 'DONE';

  @ApiPropertyOptional({
    description:
      'Duty list only: sort key. Defaults to dutyCreated (when the action was ' +
      'created). Ignored on other scopes.',
    enum: DUTY_SORT_FIELDS,
    default: 'dutyCreated',
  })
  @IsOptional()
  @IsIn(DUTY_SORT_FIELDS)
  sortBy?: DutySortField;

  @ApiPropertyOptional({
    description: 'Sort direction (default desc).',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

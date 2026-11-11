import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FlowMode, TaskType } from '@prisma/client';

/** One assignee on a step, defined by the requester when building their flow. */
export class CreateFlowAssigneeInput {
  @ApiProperty({ description: 'User id of the assignee.' })
  @IsString()
  @MinLength(1)
  userId!: string;

  /** Execution order within a SEQUENTIAL step. Ignored for PARALLEL steps. */
  @ApiPropertyOptional({
    description:
      'Execution order within a SEQUENTIAL step. Ignored for PARALLEL steps.',
  })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ enum: TaskType, default: TaskType.APPROVAL })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;
}

/** One step of a flow the requester is building for their own request. */
export class CreateFlowStepInput {
  @ApiProperty()
  @IsInt()
  order!: number;

  @ApiProperty({ enum: FlowMode })
  @IsEnum(FlowMode)
  mode!: FlowMode;

  /** Optional creator-given label for this step (shown under "Step N"). */
  @ApiPropertyOptional({
    description: 'Optional creator-given label for this step.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * Whether this step is required for the request to close. The final
   * (highest-order) step is always treated as required regardless of this flag;
   * intermediate steps default to optional.
   */
  @ApiPropertyOptional({
    default: false,
    description:
      'Whether this step is required for the request to close. The final step is always required.',
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ type: () => CreateFlowAssigneeInput, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFlowAssigneeInput)
  assignees!: CreateFlowAssigneeInput[];
}

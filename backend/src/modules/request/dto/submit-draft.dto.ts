import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateFlowStepInput } from '../../approval-flow/dto/create-flow.dto';

/**
 * Body for finalizing a DRAFT request (typically a cloned draft the requestor
 * has edited): the approval flow + viewers to start it with. Field values and
 * documents are edited via their own endpoints before submitting.
 */
export class SubmitDraftDto {
  /** Users allowed to view this request (replaces the current viewer set). */
  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  viewerIds?: string[];

  /** The approval flow to build; omit to skip approval (auto-approved). */
  @ApiPropertyOptional({ type: () => CreateFlowStepInput, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFlowStepInput)
  steps?: CreateFlowStepInput[];

  @ApiPropertyOptional({ description: 'Optional name for the flow.' })
  @IsOptional()
  @IsString()
  flowName?: string;
}

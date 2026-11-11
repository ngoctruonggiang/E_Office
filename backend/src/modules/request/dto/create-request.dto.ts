import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateFlowStepInput } from '../../approval-flow/dto/create-flow.dto';

/** One EAV value: which field, and its (arbitrary JSON) value. */
export class RequestValueInput {
  @ApiProperty({ description: 'Key of the form field this value belongs to.' })
  @IsString()
  @MinLength(1)
  fieldKey!: string;

  /** @Allow keeps the value through the whitelisting ValidationPipe. */
  @ApiProperty({
    description: 'Arbitrary JSON value; shape depends on the field type.',
  })
  @Allow()
  value!: unknown;
}

export class CreateRequestDto {
  @ApiProperty({ description: 'Form this request is filling in.' })
  @IsString()
  formId!: string;

  @ApiProperty({ type: () => RequestValueInput, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestValueInput)
  values!: RequestValueInput[];

  /**
   * Start the approval flow immediately (default true). Set false to keep the
   * request as a DRAFT you can still edit before submitting.
   */
  @ApiPropertyOptional({
    default: true,
    description:
      'Start the approval flow immediately. Set false to keep the request as a DRAFT you can still edit before submitting.',
  })
  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  /** Users allowed to view this request (workflow transparency). */
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Users allowed to view this request (workflow transparency).',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  viewerIds?: string[];

  /**
   * The approval flow for THIS request, built by the requester. Omit to skip
   * approval entirely — the request is auto-approved. There is no per-form
   * fixed flow; every request defines its own.
   */
  @ApiPropertyOptional({
    type: () => CreateFlowStepInput,
    isArray: true,
    description:
      "The approval flow for this request, built by the requester. Omit to skip approval (auto-approved). There is no per-form fixed flow — every request defines its own.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFlowStepInput)
  steps?: CreateFlowStepInput[];

  /** Optional name for the flow created for this request. */
  @ApiPropertyOptional({
    description: 'Optional name for the flow created for this request.',
  })
  @IsOptional()
  @IsString()
  flowName?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FormFieldInput } from './form-field.input';

/**
 * Updating a form. Structural changes, or any field/layout change on a version
 * that already has responses, fork a NEW version; scalar/layout tweaks on an
 * unused version patch in place.
 */
export class UpdateFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ type: () => FormFieldInput, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldInput)
  fields?: FormFieldInput[];

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'LayoutSchemaV1 JSON or null to reset to auto-layout.',
  })
  @IsOptional()
  @Allow()
  layoutSchema?: unknown;
}

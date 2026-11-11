import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FormFieldInput } from './form-field.input';

/**
 * Updating a form. If any field changes `type` or a new `key` appears, the
 * service creates a NEW version; otherwise it updates the current version
 * in place (labels, required, placeholder, …).
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
}

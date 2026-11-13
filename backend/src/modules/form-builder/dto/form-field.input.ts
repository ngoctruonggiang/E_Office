import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FieldType, SelectMode, ValidationType } from '@prisma/client';

export class FieldOptionInput {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  value!: string;
}

export class FieldValidationInput {
  @ApiProperty({ enum: ValidationType })
  @IsEnum(ValidationType)
  type!: ValidationType;

  /** Required when type = REGEX. */
  @ApiPropertyOptional({ description: 'Required when type = REGEX.' })
  @IsOptional()
  @IsString()
  regex?: string;
}

/**
 * One field definition used when creating/updating a form. The same shape
 * describes every field type; only the relevant extras are filled in.
 */
export class FormFieldInput {
  /** Stable machine key — referenced by request values (EAV fieldKey). */
  @ApiProperty({
    description:
      'Stable machine key — referenced by request values (EAV fieldKey).',
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty({ enum: FieldType })
  @IsEnum(FieldType)
  type!: FieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    description: 'Default value for this field; shape depends on type.',
  })
  @IsOptional()
  defaultValue?: unknown;

  // TEXT
  @ApiPropertyOptional({ description: 'TEXT fields only.' })
  @IsOptional()
  @IsInt()
  maxLength?: number;

  @ApiPropertyOptional({ description: 'TEXT fields only.' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  // NUMBER
  @ApiPropertyOptional({ description: 'NUMBER fields only.' })
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional({ description: 'NUMBER fields only.' })
  @IsOptional()
  @IsNumber()
  max?: number;

  // SELECT
  @ApiPropertyOptional({ enum: SelectMode, description: 'SELECT fields only.' })
  @IsOptional()
  @IsEnum(SelectMode)
  selectMode?: SelectMode;

  @ApiPropertyOptional({
    type: () => FieldOptionInput,
    isArray: true,
    description: 'SELECT fields only.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOptionInput)
  options?: FieldOptionInput[];

  @ApiPropertyOptional({ type: () => FieldValidationInput, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldValidationInput)
  validations?: FieldValidationInput[];

  // TABLE
  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'TABLE fields only (columns, minRows, maxRows, addRowLabel, summary).',
  })
  @IsOptional()
  @Allow()
  tableConfig?: unknown;
}

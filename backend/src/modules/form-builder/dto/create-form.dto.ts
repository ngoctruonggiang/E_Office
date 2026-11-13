import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FormFieldInput } from './form-field.input';

export class CreateFormDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ type: () => FormFieldInput, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormFieldInput)
  fields!: FormFieldInput[];

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'LayoutSchemaV1 JSON describing sections, 12-col rows, conditions, and attachment hints.',
  })
  @IsOptional()
  @Allow()
  layoutSchema?: unknown;
}

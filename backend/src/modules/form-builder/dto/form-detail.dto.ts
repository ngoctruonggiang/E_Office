import { ApiProperty } from '@nestjs/swagger';
import { FieldType, SelectMode, ValidationType } from '@prisma/client';

/** Assembled, render-ready form returned to the frontend. */
export class FieldOptionView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  value!: string;
}

export class FieldValidationView {
  @ApiProperty({ enum: ValidationType })
  type!: ValidationType;

  @ApiProperty({ nullable: true, type: String })
  regex!: string | null;
}

export class FormFieldView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: FieldType })
  type!: FieldType;

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ description: 'Shape depends on field type.' })
  defaultValue!: unknown;

  @ApiProperty({ nullable: true, type: Number })
  maxLength!: number | null;

  @ApiProperty({ nullable: true, type: String })
  placeholder!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  min!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  max!: number | null;

  @ApiProperty({ enum: SelectMode, nullable: true })
  selectMode!: SelectMode | null;

  @ApiProperty({
    nullable: true,
    type: Object,
    description: 'TABLE fields only (columns, minRows, maxRows, summary).',
  })
  tableConfig!: unknown;

  @ApiProperty({ type: () => FieldOptionView, isArray: true })
  options!: FieldOptionView[];

  @ApiProperty({ type: () => FieldValidationView, isArray: true })
  validations!: FieldValidationView[];
}

export class FormDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  versionId!: string;

  @ApiProperty({
    nullable: true,
    type: Object,
    description: 'LayoutSchemaV1 JSON or null when using fallback layout.',
  })
  layoutSchema!: unknown;

  @ApiProperty({ type: () => FormFieldView, isArray: true })
  fields!: FormFieldView[];
}

/** List item — one form category, for the "pick a form to fill in" picker. */
export class FormSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Version number of the latest version.' })
  latestVersion!: number;

  @ApiProperty({
    description: 'Total requests filed against any version of this form.',
  })
  requestCount!: number;

  @ApiProperty()
  createdAt!: Date;
}

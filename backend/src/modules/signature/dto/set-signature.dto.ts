import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** One signature box placed on the signing document for a chosen approver. */
export class SignatureFieldInput {
  @ApiProperty({ description: 'User id of the approver this box belongs to.' })
  @IsString()
  assigneeId!: string;

  @ApiProperty({ description: '1-based page number.' })
  @IsInt()
  @Min(1)
  page!: number;

  @ApiProperty({ description: 'Left, % of page width (top-left origin).' })
  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @ApiProperty({ description: 'Top, % of page height (top-left origin).' })
  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;

  @ApiProperty({ description: 'Width, % of page width.' })
  @IsNumber()
  @Min(0)
  @Max(100)
  width!: number;

  @ApiProperty({ description: 'Height, % of page height.' })
  @IsNumber()
  @Min(0)
  @Max(100)
  height!: number;
}

/**
 * Replace the request's signing document + all of its signature boxes ("from
 * scratch"). Pass documentId = null (or omit) with an empty fields array to
 * clear signing entirely.
 */
export class SetSignatureDto {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Attached document to designate as the signing document.',
  })
  @IsOptional()
  @IsString()
  documentId?: string | null;

  @ApiProperty({ type: () => SignatureFieldInput, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignatureFieldInput)
  fields!: SignatureFieldInput[];
}

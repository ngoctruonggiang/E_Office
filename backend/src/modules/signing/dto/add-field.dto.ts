import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

/**
 * A signature placement. Coordinates are page-relative percentages (0–100),
 * matching Documenso's pageX/pageY/pageWidth/pageHeight model.
 */
export class AddFieldDto {
  @ApiProperty({ description: 'SigningRecipient id this field belongs to.' })
  @IsUUID()
  recipientId!: string;

  @ApiProperty({ description: '1-based page number.', minimum: 1 })
  @IsInt()
  @Min(1)
  page!: number;

  @ApiProperty({ description: 'X position, % from left edge (0–100).' })
  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @ApiProperty({ description: 'Y position, % from top edge (0–100).' })
  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;

  @ApiProperty({ description: 'Width, % of page width (0–100).' })
  @IsNumber()
  @Min(1)
  @Max(100)
  width!: number;

  @ApiProperty({ description: 'Height, % of page height (0–100).' })
  @IsNumber()
  @Min(1)
  @Max(100)
  height!: number;
}

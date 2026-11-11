import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  /**
   * Reusable signature name (rendered cursive under the signature image when a
   * document is stamped). Send an empty string to clear it.
   */
  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  signatureName?: string;

  /**
   * Reusable signature image as a data URL (PNG/JPEG). Send an empty string to
   * clear it. ~1.5MB cap to keep the data-URL row reasonable.
   */
  @ApiPropertyOptional({
    description: 'Signature image as a data URL (PNG/JPEG), or empty to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  signatureImage?: string;
}

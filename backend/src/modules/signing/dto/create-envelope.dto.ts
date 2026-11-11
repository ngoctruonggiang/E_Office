import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEnvelopeDto {
  @ApiPropertyOptional({
    description: 'Display title; defaults to the uploaded filename.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

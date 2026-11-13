import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SignAndApproveDto {
  @ApiPropertyOptional({ type: [String], description: 'List of SignatureField UUIDs being signed' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signatureFieldIds?: string[];

  @ApiPropertyOptional({ description: 'Data URL image of user signature stamp' })
  @IsOptional()
  @IsString()
  signatureImage?: string;

  @ApiPropertyOptional({ description: 'Full name displayed under signature' })
  @IsOptional()
  @IsString()
  signatureName?: string;

  @ApiPropertyOptional({ description: 'Approval comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}


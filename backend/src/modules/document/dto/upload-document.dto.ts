import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType, RequestDocSection } from '@prisma/client';

/** Multipart text fields accompanying the uploaded file. */
export class UploadDocumentDto {
  /** Optional request to attach this document to. */
  @ApiPropertyOptional({ description: 'Request to attach this document to.' })
  @IsOptional()
  @IsString()
  requestId?: string;

  /** Display name; defaults to the original filename. */
  @ApiPropertyOptional({
    description: 'Display name; defaults to the original filename.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  /**
   * Section this attachment occupies within the request (only meaningful with
   * requestId). MAIN = core content, creator-managed, editable only while DRAFT;
   * SECONDARY (default) = supporting file anyone with access may add.
   */
  @ApiPropertyOptional({ enum: RequestDocSection, default: RequestDocSection.SECONDARY })
  @IsOptional()
  @IsEnum(RequestDocSection)
  section?: RequestDocSection;
}

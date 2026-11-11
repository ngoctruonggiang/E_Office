import { ApiProperty } from '@nestjs/swagger';
import { Document, DocumentType } from '@prisma/client';

/** Public document shape (internal filePath is not exposed). */
export class DocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  mimeType!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  size!: number | null;

  @ApiProperty({ enum: DocumentType })
  type!: DocumentType;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  deletedFlag!: boolean;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(doc: Document): DocumentResponseDto {
    return {
      id: doc.id,
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.size,
      type: doc.type,
      createdById: doc.createdById,
      deletedFlag: doc.deletedFlag,
      createdAt: doc.createdAt,
    };
  }
}

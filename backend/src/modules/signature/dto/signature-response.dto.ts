import { ApiProperty } from '@nestjs/swagger';
import { SignatureField, SignatureStatus } from '@prisma/client';

/** A signature box + its per-approver sign state, as returned to the client. */
export class SignatureFieldView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  assigneeId!: string;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  x!: number;

  @ApiProperty()
  y!: number;

  @ApiProperty()
  width!: number;

  @ApiProperty()
  height!: number;

  @ApiProperty({ enum: SignatureStatus })
  status!: SignatureStatus;

  @ApiProperty({ nullable: true, type: String })
  signatureName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  signatureImage!: string | null;

  @ApiProperty({ nullable: true, type: Date })
  signedAt!: Date | null;

  static fromEntity(f: SignatureField): SignatureFieldView {
    return {
      id: f.id,
      documentId: f.documentId,
      assigneeId: f.assigneeId,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      status: f.status,
      signatureName: f.signatureName,
      signatureImage: f.signatureImage,
      signedAt: f.signedAt,
    };
  }
}

/** The full signing state for a request: the signing doc + its boxes. */
export class SignatureStateDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The designated signing document id (null when none).',
  })
  documentId!: string | null;

  @ApiProperty({ type: () => SignatureFieldView, isArray: true })
  fields!: SignatureFieldView[];
}

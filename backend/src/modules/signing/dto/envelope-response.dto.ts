import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  SigningEnvelope,
  SigningEnvelopeStatus,
  SigningField,
  SigningRecipient,
  SigningRecipientStatus,
} from '@prisma/client';

type EnvelopeWithRelations = SigningEnvelope & {
  recipients: SigningRecipient[];
  fields: SigningField[];
};

export class FieldResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() recipientId!: string;
  @ApiProperty() page!: number;
  @ApiProperty() x!: number;
  @ApiProperty() y!: number;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;

  static fromEntity(f: SigningField): FieldResponseDto {
    return {
      id: f.id,
      recipientId: f.recipientId,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
    };
  }
}

export class RecipientResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['NOT_SIGNED', 'SIGNED'] })
  status!: SigningRecipientStatus;
  @ApiPropertyOptional({ type: String, nullable: true })
  signedAt!: string | null;

  @ApiPropertyOptional({
    description:
      'The Documenso signing page URL. Only present for the recipient themselves.',
  })
  signingUrl?: string;

  static fromEntity(
    r: SigningRecipient,
    currentUserId: string,
  ): RecipientResponseDto {
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      status: r.status,
      signedAt: r.signedAt ? r.signedAt.toISOString() : null,
      // Expose the signing link only to the matching assignee.
      signingUrl: r.userId === currentUserId ? r.signingUrl : undefined,
    };
  }
}

export class EnvelopeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ['DRAFT', 'PENDING', 'COMPLETED'] })
  status!: SigningEnvelopeStatus;
  @ApiProperty() documensoDocumentId!: number;
  @ApiProperty() ownerId!: string;
  @ApiProperty({ description: 'Whether the requesting user owns this envelope.' })
  isOwner!: boolean;
  @ApiProperty({ type: [RecipientResponseDto] })
  recipients!: RecipientResponseDto[];
  @ApiProperty({ type: [FieldResponseDto] })
  fields!: FieldResponseDto[];
  @ApiProperty() createdAt!: string;

  static fromEntity(
    e: EnvelopeWithRelations,
    currentUserId: string,
  ): EnvelopeResponseDto {
    return {
      id: e.id,
      title: e.title,
      status: e.status,
      documensoDocumentId: e.documensoDocumentId,
      ownerId: e.ownerId,
      isOwner: e.ownerId === currentUserId,
      recipients: e.recipients.map((r) =>
        RecipientResponseDto.fromEntity(r, currentUserId),
      ),
      fields: e.fields.map((f) => FieldResponseDto.fromEntity(f)),
      createdAt: e.createdAt.toISOString(),
    };
  }
}

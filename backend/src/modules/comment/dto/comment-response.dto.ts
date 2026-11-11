import { ApiProperty } from '@nestjs/swagger';

class CommentAuthorView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;
}

class CommentAttachmentView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  documentId!: string;

  @ApiProperty({ description: 'Document display name.' })
  name!: string;
}

/** A comment with its author, like state, attachments and nested replies. */
export class CommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  responseId!: string;

  @ApiProperty()
  authorId!: string;

  @ApiProperty({ type: () => CommentAuthorView })
  author!: CommentAuthorView;

  @ApiProperty({ nullable: true, type: String })
  parentId!: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Approval step order this belongs to; null = request feed.',
  })
  stepOrder!: number | null;

  @ApiProperty({ description: 'Empty when the comment was deleted.' })
  body!: string;

  @ApiProperty()
  edited!: boolean;

  @ApiProperty()
  deleted!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ description: 'Number of likes.' })
  likeCount!: number;

  @ApiProperty({ description: 'Whether the current user liked this comment.' })
  likedByMe!: boolean;

  @ApiProperty({ type: () => CommentAttachmentView, isArray: true })
  attachments!: CommentAttachmentView[];

  @ApiProperty({ type: () => CommentDto, isArray: true })
  replies!: CommentDto[];
}

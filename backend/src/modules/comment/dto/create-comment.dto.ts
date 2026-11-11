import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Body for posting a comment on a request (or a reply / step note). */
export class CreateCommentDto {
  @ApiProperty({ description: 'Comment text.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    description: 'Parent comment id when this is a reply.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description:
      'Approval step `order` this comment is scoped to. Omit for the request-level feed.',
  })
  @IsOptional()
  @IsInt()
  stepOrder?: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Document ids to attach. Upload via POST /documents/upload (with requestId) first, then pass the returned ids here.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  attachmentDocumentIds?: string[];
}

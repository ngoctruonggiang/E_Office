import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body for editing a comment (author only). */
export class UpdateCommentDto {
  @ApiProperty({ description: 'New comment text.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

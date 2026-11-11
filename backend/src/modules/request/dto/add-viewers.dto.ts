import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** Body for adding viewers (watchers) to a request's viewable list. */
export class AddViewersDto {
  @ApiProperty({
    type: [String],
    description: 'User ids to grant view access to.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds!: string[];
}

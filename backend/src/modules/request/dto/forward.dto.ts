import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Body for FORWARD: the user to reassign the current task to. */
export class ForwardDto {
  @ApiProperty({ description: 'User id to reassign the current task to.' })
  @IsString()
  @MinLength(1)
  toUserId!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Admin password reset payload (POST /users/:id/password). */
export class SetPasswordDto {
  @ApiProperty({
    example: 'P@ssw0rd123',
    minLength: 8,
    maxLength: 72,
    description: 'Between 8 and 72 characters (bcrypt hard limit).',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password must be at most 72 characters long' })
  password!: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Admin update of an account (PATCH /users/:id). All fields optional. */
export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ enum: ['admin', 'user'] })
  @IsOptional()
  @IsIn(['admin', 'user'])
  role?: string;

  @ApiPropertyOptional({ description: 'Activate / deactivate the account.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

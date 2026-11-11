import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/** Add an existing user to a root company's roster. */
export class AddMemberDto {
  @ApiProperty({ description: 'Id of an existing user.' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ enum: ['manager', 'member'], default: 'member' })
  @IsOptional()
  @IsIn(['manager', 'member'])
  role?: string;
}

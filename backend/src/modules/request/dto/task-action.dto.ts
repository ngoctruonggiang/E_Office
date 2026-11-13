import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TaskActionDto {
  @ApiPropertyOptional({ description: 'Action comment or reason' })
  @IsOptional()
  @IsString()
  comment?: string;
}


import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskAction } from '@prisma/client';

/** Body for a request approval action (approve / reject / …). */
export class ApprovalActionDto {
  @ApiProperty({ enum: TaskAction })
  @IsEnum(TaskAction)
  action!: TaskAction;

  /** Optional note (not persisted in this version). */
  @ApiPropertyOptional({
    description: 'Optional note (not persisted in this version).',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

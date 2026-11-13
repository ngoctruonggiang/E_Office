import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CloneProcedureRequestDto {
  @ApiProperty({ enum: ['reset', 'reserve'], description: 'reset = restore default approvers; reserve = keep valid overrides', example: 'reserve' })
  @IsIn(['reset', 'reserve'])
  mode: 'reset' | 'reserve';
}


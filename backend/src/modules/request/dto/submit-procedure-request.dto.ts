import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class SubmitProcedureRequestDto {
  @ApiPropertyOptional({ description: 'Optional updated form field values on submission' })
  @IsOptional()
  @IsObject()
  values?: Record<string, any>;
}


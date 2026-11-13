import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRequestFromProcedureDto {
  @ApiPropertyOptional({ description: 'Procedure UUID' })
  @IsOptional()
  @IsUUID()
  procedureId?: string;

  @ApiPropertyOptional({ description: 'ProcedureVersion UUID (if targeting specific version)' })
  @IsOptional()
  @IsUUID()
  procedureVersionId?: string;
}


import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class PreviewFlowDto {
  @ApiProperty({ description: 'Key-value map of form fields and entered values', example: { total_amount: 75000000 } })
  @IsObject()
  values: Record<string, any>;
}


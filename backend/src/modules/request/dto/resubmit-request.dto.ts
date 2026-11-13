import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class ResubmitRequestDto {
  @ApiProperty({ description: 'Updated form field values', example: { total_amount: 80000000 } })
  @IsObject()
  values: Record<string, any>;

  @ApiPropertyOptional({ description: 'Comment from requester explaining modifications' })
  @IsOptional()
  @IsString()
  comment?: string;
}


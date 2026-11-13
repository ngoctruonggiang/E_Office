import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateProcedureDto {
  @ApiProperty({
    description: 'Unique procedure code (uppercase letters, numbers, hyphens and underscores)',
    example: 'PROC_PURCHASE_01',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must only contain uppercase letters, numbers, underscores and hyphens',
  })
  @MaxLength(64)
  code: string;

  @ApiProperty({
    description: 'Human-readable name of the procedure',
    example: 'Yêu cầu Mua sắm Hàng hóa & Dịch vụ',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the procedure and usage guidelines',
    example: 'Thủ tục phê duyệt mua sắm trang thiết bị, vật tư văn phòng',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Managing organization / department unit ID',
    example: 'dept-it-001',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Lucide icon name',
    default: 'file-text',
    example: 'shopping-cart',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    description: 'Theme color hex code',
    default: '#2563eb',
    example: '#2563eb',
  })
  @IsOptional()
  @IsString()
  color?: string;
}


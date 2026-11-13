import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProcedureDto {
  @ApiPropertyOptional({
    description: 'Human-readable name of the procedure',
    example: 'Yêu cầu Mua sắm Hàng hóa & Dịch vụ (Đã cập nhật)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the procedure',
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
    example: 'shopping-cart',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    description: 'Theme color hex code',
    example: '#16a34a',
  })
  @IsOptional()
  @IsString()
  color?: string;
}


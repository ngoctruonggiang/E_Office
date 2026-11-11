import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddRecipientDto {
  @ApiProperty({
    description: 'The gafood user id to add as a signer (from GET /users).',
  })
  @IsUUID()
  userId!: string;
}

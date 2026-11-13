import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../entities/user.entity';

/**
 * Public-facing user shape. NEVER contains passwordHash.
 * Use `UserResponseDto.fromEntity` at every boundary that returns a user.
 */
export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true, type: String })
  department!: string | null;

  @ApiProperty({ nullable: true, type: String })
  title!: string | null;

  @ApiProperty({ nullable: true, type: String })
  keycloakSub!: string | null;

  @ApiProperty({ nullable: true, type: String })
  signatureName!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Signature image as a data URL (PNG/JPEG), if set.',
  })
  signatureImage!: string | null;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      department: user.department ?? null,
      title: user.title ?? null,
      keycloakSub: user.keycloakSub ?? null,
      signatureName: user.signatureName,
      signatureImage: user.signatureImage,
      createdAt: user.createdAt,
    };
  }
}

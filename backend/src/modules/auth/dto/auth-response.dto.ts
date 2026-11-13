import { ApiProperty } from '@nestjs/swagger';
import { AuthResult } from '../interfaces/auth-provider.interface';

class AuthUserView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ required: false })
  displayName?: string | null;

  @ApiProperty({ required: false })
  department?: string | null;

  @ApiProperty({ required: false })
  title?: string | null;
}

/** Shape returned by login / register / refresh. */
export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Access token lifetime, in seconds.' })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserView })
  user!: {
    id: string;
    email: string;
    role: string;
    displayName?: string | null;
    department?: string | null;
    title?: string | null;
  };

  @ApiProperty({
    description:
      'Echoed back so the client persists it and reuses it on refresh/logout.',
  })
  deviceId!: string;

  static fromResult(result: AuthResult, deviceId: string): AuthResponseDto {
    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      tokenType: result.tokens.tokenType,
      expiresIn: result.tokens.expiresIn,
      user: {
        id: result.user.userId,
        email: result.user.email,
        role: result.user.role,
        displayName: result.user.displayName,
        department: result.user.department,
        title: result.user.title,
      },
      deviceId,
    };
  }
}

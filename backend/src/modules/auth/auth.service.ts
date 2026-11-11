import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AUTH_PROVIDER } from './interfaces/auth-provider.interface';
import type {
  AuthProvider,
  AuthResult,
  AuthenticatedUser,
} from './interfaces/auth-provider.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

/**
 * Application-facing facade. Controllers depend on AuthService; AuthService
 * delegates the actual identity work to whichever AuthProvider is bound
 * (local today, OIDC/OAuth2 tomorrow). It also normalises the deviceId.
 */
@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_PROVIDER) private readonly provider: AuthProvider) {}

  /** A deviceId ties a refresh token to one client/session. */
  resolveDeviceId(provided?: string): string {
    return provided?.trim() || randomUUID();
  }

  register(dto: RegisterDto, deviceId: string): Promise<AuthResult> {
    return this.provider.register({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
      deviceId,
    });
  }

  login(dto: LoginDto, deviceId: string): Promise<AuthResult> {
    return this.provider.login({
      email: dto.email,
      password: dto.password,
      deviceId,
    });
  }

  refresh(dto: RefreshTokenDto, deviceId: string): Promise<AuthResult> {
    return this.provider.refresh({
      refreshToken: dto.refreshToken,
      deviceId,
    });
  }

  logout(
    user: AuthenticatedUser,
    accessExpiresInSec: number,
    allDevices = false,
  ): Promise<void> {
    return this.provider.logout({
      userId: user.userId,
      deviceId: user.deviceId,
      accessJti: user.jti,
      accessExpiresInSec,
      allDevices,
    });
  }
}

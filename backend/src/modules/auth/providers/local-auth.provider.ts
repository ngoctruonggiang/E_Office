import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../user/user.service';
import { TokenService } from '../token/token.service';
import {
  AuthProvider,
  AuthResult,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from '../interfaces/auth-provider.interface';
import { UserEntity } from '../../user/entities/user.entity';

const BCRYPT_ROUNDS = 12;

/**
 * Default AuthProvider: local email + password auth with JWTs issued by us.
 *
 * To migrate to an external IdP (OAuth2 / OIDC) you implement a new provider
 * with the same interface and rebind AUTH_PROVIDER in auth.module.ts — nothing
 * else in the codebase changes.
 */
@Injectable()
export class LocalAuthProvider implements AuthProvider {
  constructor(
    private readonly users: UserService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName ?? null,
    });

    return this.buildResult(user, input.deviceId);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);

    // Run bcrypt.compare even when the user is missing to blunt timing/user
    // enumeration; always return the same generic error.
    const ok =
      user &&
      user.passwordHash &&
      (await bcrypt.compare(input.password, user.passwordHash));
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.buildResult(user, input.deviceId);
  }

  async refresh(input: RefreshInput): Promise<AuthResult> {
    const tokens = await this.tokens.rotateRefreshToken(
      input.refreshToken,
      input.deviceId,
      async (userId) => {
        const user = await this.users.getByIdOrThrow(userId);
        return { userId: user.id, email: user.email, role: user.role };
      },
    );

    return this.resultFromTokens(tokens);
  }

  async logout(input: LogoutInput): Promise<void> {
    await this.tokens.blacklistAccessToken(
      input.accessJti,
      input.accessExpiresInSec,
    );
    if (input.allDevices) {
      await this.tokens.revokeAllRefreshTokens(input.userId);
    } else {
      await this.tokens.revokeRefreshToken(input.userId, input.deviceId);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async buildResult(
    user: UserEntity,
    deviceId: string,
  ): Promise<AuthResult> {
    const subject = {
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      department: user.department,
      title: user.title,
    };
    const tokens = await this.tokens.issueTokenPair(subject, deviceId);
    await this.tokens.cacheSession(subject);
    return { user: subject, tokens };
  }

  /** Build the response envelope after a rotation (identity comes from token). */
  private resultFromTokens(tokens: AuthResult['tokens']): AuthResult {
    // The rotated access token already encodes the identity; decode it so the
    // controller can echo user info without an extra DB round-trip.
    const [, payloadB64] = tokens.accessToken.split('.');
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as { sub: string; email: string; role: string };

    return {
      user: { userId: payload.sub, email: payload.email, role: payload.role },
      tokens,
    };
  }
}

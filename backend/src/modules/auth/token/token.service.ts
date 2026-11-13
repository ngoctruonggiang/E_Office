import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { RedisService } from '../../../core/redis/redis.service';
import { RedisKeys } from '../../../core/redis/redis.constants';
import {
  AuthTokens,
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/auth-provider.interface';

interface IssueSubject {
  userId: string;
  email: string;
  role: string;
  displayName?: string | null;
  department?: string | null;
  title?: string | null;
}

/**
 * Owns everything token-related:
 *  - signing/verifying access & refresh JWTs (separate secrets),
 *  - persisting the *hash* of the active refresh token per device in Redis,
 *  - refresh-token ROTATION with reuse detection,
 *  - access-token REVOCATION via a Redis blacklist keyed by jti.
 *
 * Refresh tokens are deliberately NOT stored in the database — Redis gives us
 * automatic TTL expiry and O(1) revocation.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTtl = Number(this.config.get('JWT_ACCESS_TTL', 900));
    this.refreshTtl = Number(this.config.get('JWT_REFRESH_TTL', 604800));
  }

  /**
   * Issue a brand-new access+refresh pair for a (user, device) and store the
   * refresh token hash in Redis. Used by login & register, and internally by
   * rotation.
   */
  async issueTokenPair(
    subject: IssueSubject,
    deviceId: string,
  ): Promise<AuthTokens> {
    const jti = randomUUID();

    const payload: JwtPayload = {
      sub: subject.userId,
      email: subject.email,
      role: subject.role,
      displayName: subject.displayName,
      department: subject.department,
      title: subject.title,
      jti,
      deviceId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });

    // Refresh token carries the same jti/deviceId binding but its own secret.
    const refreshToken = await this.jwt.signAsync(
      { sub: subject.userId, jti, deviceId, typ: 'refresh' },
      { secret: this.refreshSecret, expiresIn: this.refreshTtl },
    );

    // Store ONLY a hash so a Redis dump never leaks usable tokens.
    await this.redis.set(
      RedisKeys.refreshToken(subject.userId, deviceId),
      this.hash(refreshToken),
      this.refreshTtl,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtl,
    };
  }

  /**
   * Refresh-token ROTATION.
   *
   * 1. Cryptographically verify the refresh JWT (signature + expiry).
   * 2. Confirm it is the *currently stored* token for that device. If the hash
   *    does not match, the token was already rotated → treat as reuse/theft,
   *    revoke every session for the user and reject.
   * 3. Issue and persist a new pair (the old hash is overwritten).
   */
  async rotateRefreshToken(
    refreshToken: string,
    expectedDeviceId: string,
    resolveSubject: (userId: string) => Promise<IssueSubject>,
  ): Promise<AuthTokens> {
    let decoded: { sub: string; deviceId: string };
    try {
      decoded = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (decoded.deviceId !== expectedDeviceId) {
      throw new UnauthorizedException('Refresh token / device mismatch');
    }

    const key = RedisKeys.refreshToken(decoded.sub, decoded.deviceId);
    const storedHash = await this.redis.get(key);

    if (!storedHash) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (storedHash !== this.hash(refreshToken)) {
      // Reuse of an already-rotated token → likely theft. Nuke all sessions.
      this.logger.warn(
        `Refresh token reuse detected for user ${decoded.sub}; revoking all sessions`,
      );
      await this.revokeAllRefreshTokens(decoded.sub);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const subject = await resolveSubject(decoded.sub);
    // issueTokenPair overwrites the stored hash → old refresh token is now dead.
    return this.issueTokenPair(subject, decoded.deviceId);
  }

  /** Revoke a single device's refresh token (normal logout). */
  async revokeRefreshToken(userId: string, deviceId: string): Promise<void> {
    await this.redis.del(RedisKeys.refreshToken(userId, deviceId));
  }

  /** Revoke every refresh token for a user (logout everywhere / theft). */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.redis.delByPattern(RedisKeys.refreshTokenPattern(userId));
  }

  /**
   * Blacklist an access token by jti until its natural expiry, so it can no
   * longer be used even though it is still cryptographically valid.
   */
  async blacklistAccessToken(jti: string, expiresInSec: number): Promise<void> {
    if (expiresInSec <= 0) return;
    await this.redis.set(RedisKeys.blacklist(jti), '1', expiresInSec);
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    return this.redis.exists(RedisKeys.blacklist(jti));
  }

  /** Cache a lightweight session snapshot to avoid a DB hit on every request. */
  async cacheSession(
    user: Pick<AuthenticatedUser, 'userId' | 'email' | 'role'>,
  ): Promise<void> {
    await this.redis.setJson(
      RedisKeys.session(user.userId),
      { email: user.email, role: user.role },
      this.refreshTtl,
    );
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

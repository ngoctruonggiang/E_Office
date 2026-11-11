import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenService } from '../token/token.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/auth-provider.interface';

export const JWT_STRATEGY = 'jwt';

/**
 * Validates ACCESS tokens on protected routes. Beyond the standard signature +
 * expiry check, it rejects tokens whose jti has been blacklisted (logout /
 * revoke). The returned object becomes `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY) {
  constructor(
    config: ConfigService,
    private readonly tokens: TokenService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(
    payload: JwtPayload & { exp: number },
  ): Promise<AuthenticatedUser> {
    if (await this.tokens.isAccessTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
      deviceId: payload.deviceId,
      accessExp: payload.exp,
    };
  }
}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RedisThrottleGuard } from './guards/redis-throttle.guard';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { AUTH_PROVIDER } from './interfaces/auth-provider.interface';

/**
 * Wires the auth feature together.
 *
 * The SSO seam lives in the AUTH_PROVIDER binding below: swap LocalAuthProvider
 * for an OIDC/OAuth2 provider and the rest of the app is unaffected.
 *
 * JwtModule is registered empty — secrets/TTLs are passed per-sign in
 * TokenService so access and refresh tokens can use different secrets.
 */
@Module({
  imports: [UserModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    RedisThrottleGuard,
    // ── SSO seam ──────────────────────────────────────────────
    { provide: AUTH_PROVIDER, useClass: LocalAuthProvider },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}

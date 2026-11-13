import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../core/common/decorators/public.decorator';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import { RateLimit } from '../../core/common/decorators/rate-limit.decorator';
import { RedisThrottleGuard } from './guards/redis-throttle.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import type { AuthenticatedUser } from './interfaces/auth-provider.interface';

/**
 * Auth endpoints.
 *  - register / login / refresh are @Public (skip the global JwtAuthGuard) but
 *    are Redis-rate-limited via @RateLimit + RedisThrottleGuard.
 *  - logout requires a valid access token (global guard) so we know whom to
 *    revoke.
 */
@ApiTags('auth')
@Controller('auth')
@UseGuards(RedisThrottleGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @RateLimit({ limit: 5, ttl: 60 })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new account and sign in' })
  @ApiCreatedResponse({
    description: 'Account created, tokens issued.',
    type: AuthResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (5/min).' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const deviceId = this.authService.resolveDeviceId(dto.deviceId);
    const result = await this.authService.register(dto, deviceId);
    return AuthResponseDto.fromResult(result, deviceId);
  }

  @Public()
  @Post('login')
  @RateLimit({ limit: 5, ttl: 60 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ description: 'Tokens issued.', type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (5/min).' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const deviceId = this.authService.resolveDeviceId(dto.deviceId);
    const result = await this.authService.login(dto, deviceId);
    return AuthResponseDto.fromResult(result, deviceId);
  }

  @Public()
  @Post('refresh')
  @RateLimit({ limit: 10, ttl: 60 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiOkResponse({ description: 'Tokens rotated.', type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid, expired, or revoked.',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (10/min).' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const deviceId = this.authService.resolveDeviceId(dto.deviceId);
    const result = await this.authService.refresh(dto, deviceId);
    return AuthResponseDto.fromResult(result, deviceId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out of the current device' })
  @ApiNoContentResponse({
    description: 'Refresh token for this device revoked.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    const remaining = Math.max(
      0,
      user.accessExp - Math.floor(Date.now() / 1000),
    );
    await this.authService.logout(user, remaining, false);
  }

  /** Logout from every device (revoke all refresh tokens for the user). */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out of every device' })
  @ApiNoContentResponse({
    description: 'Refresh tokens for all devices revoked.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    const remaining = Math.max(
      0,
      user.accessExp - Math.floor(Date.now() / 1000),
    );
    await this.authService.logout(user, remaining, true);
  }

  @Public()
  @Get('sso/config')
  @ApiOperation({ summary: 'Get Keycloak SSO configuration' })
  getSsoConfig() {
    return this.authService.getSsoConfig();
  }

  @Public()
  @Post('sso/session')
  @RateLimit({ limit: 15, ttl: 60 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange Keycloak OIDC token for e-Office session' })
  @ApiOkResponse({ description: 'SSO Session created.', type: AuthResponseDto })
  async exchangeSso(
    @Body() dto: { accessToken: string; idToken?: string; deviceId?: string },
  ): Promise<AuthResponseDto> {
    const deviceId = this.authService.resolveDeviceId(dto.deviceId);
    const result = await this.authService.exchangeSsoToken(dto, deviceId);
    return AuthResponseDto.fromResult(result, deviceId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

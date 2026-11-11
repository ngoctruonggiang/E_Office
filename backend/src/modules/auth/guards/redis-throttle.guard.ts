import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../../../core/redis/redis.service';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../../../core/common/decorators/rate-limit.decorator';

/**
 * Distributed, Redis-backed fixed-window rate limiter for sensitive endpoints
 * (login / register / refresh). Because the counter lives in Redis it works
 * across multiple app instances — unlike the in-memory @nestjs/throttler guard
 * which only protects a single process.
 *
 * Keyed by route + client IP. Routes opt in via @RateLimit({ limit, ttl }).
 */
@Injectable()
export class RedisThrottleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RateLimit on this route → nothing to enforce.
    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const routeKey = `${req.method}:${req.baseUrl}${req.path}`;
    const key = `ratelimit:${routeKey}:${ip}`;

    const hits = await this.redis.incrementWithTtl(key, options.ttl);

    if (hits > options.limit) {
      throw new HttpException(
        'Too many requests, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

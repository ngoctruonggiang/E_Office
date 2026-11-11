import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'redisRateLimit';

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  ttl: number;
}

/**
 * Declares a Redis-backed rate limit for a route (per client IP).
 * Enforced by RedisThrottleGuard. Use on auth endpoints:
 *   @RateLimit({ limit: 5, ttl: 60 })
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

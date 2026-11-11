/** DI token for the raw ioredis client. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Centralised key builders so every key namespace lives in one place.
 * Keeping these together avoids accidental key collisions across features.
 */
export const RedisKeys = {
  /** Hashed refresh token for a given user + device. */
  refreshToken: (userId: string, deviceId: string): string =>
    `auth:refresh:${userId}:${deviceId}`,

  /** Pattern to wipe every refresh token of a user (logout-all). */
  refreshTokenPattern: (userId: string): string => `auth:refresh:${userId}:*`,

  /** Blacklisted (revoked) access token, keyed by its JWT id. */
  blacklist: (jti: string): string => `auth:blacklist:${jti}`,

  /** Cached user session/profile snapshot. */
  session: (userId: string): string => `auth:session:${userId}`,
};

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as publicly accessible, bypassing the global JwtAuthGuard.
 * Used on login / register / refresh endpoints.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

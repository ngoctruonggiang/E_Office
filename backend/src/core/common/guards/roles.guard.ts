import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../modules/auth/interfaces/auth-provider.interface';

/**
 * Enforces @Roles(...). Runs after the global JwtAuthGuard, so req.user is set.
 * Routes without @Roles are unaffected.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !user.role) {
      throw new ForbiddenException('Insufficient role');
    }

    const normalizedUserRole = user.role.trim().toLowerCase();
    const hasRole = roles.some((r) => {
      const normalizedRequired = r.trim().toLowerCase();
      if (normalizedRequired === normalizedUserRole) return true;
      // In e-Office, 'admin' and 'super_admin' grant full administrative privileges
      if (
        (normalizedUserRole === 'admin' || normalizedUserRole === 'super_admin') &&
        (normalizedRequired === 'admin' || normalizedRequired === 'super_admin')
      ) {
        return true;
      }
      return false;
    });

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

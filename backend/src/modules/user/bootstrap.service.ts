import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from './user.service';

const DEFAULT_ADMIN_EMAIL = 'admin@gafood.local';
const DEFAULT_ADMIN_PASSWORD = 'admin@P@ssw0rd123';

/**
 * Ensures a system administrator account exists on every boot.
 *
 *  - If no user with role "admin" exists, one is created from ADMIN_EMAIL /
 *    ADMIN_PASSWORD (falling back to built-in defaults) and the credentials
 *    are logged ONCE so a fresh deployment is reachable.
 *  - If an admin already exists, only its email is logged (never a hash).
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly users: UserService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const adminCount = await this.users.countByRole('admin');
    if (adminCount > 0) {
      this.logger.log(
        `Admin account present (${adminCount} found); skipping bootstrap.`,
      );
      return;
    }

    const email = (
      this.config.get<string>('ADMIN_EMAIL') ?? DEFAULT_ADMIN_EMAIL
    ).toLowerCase();
    const password =
      this.config.get<string>('ADMIN_PASSWORD') ?? DEFAULT_ADMIN_PASSWORD;

    // An account may already exist with this email under a non-admin role —
    // promote it rather than failing on the unique constraint.
    const existing = await this.users.findByEmail(email);
    if (existing) {
      await this.users.updateUser(existing.id, { role: 'admin' });
      this.logger.warn(
        `Promoted existing account ${email} to admin (no admin existed).`,
      );
      return;
    }

    await this.users.adminCreate({
      email,
      password,
      displayName: 'Administrator',
      role: 'admin',
    });
    this.logger.warn(
      `Default admin created → email: ${email} | password: ${password} — ` +
        'change this password immediately.',
    );
  }
}

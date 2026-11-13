import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { LocalAuthProvider } from './local-auth.provider';
import {
  AuthProvider,
  AuthResult,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  SsoExchangeInput,
} from '../interfaces/auth-provider.interface';

@Injectable()
export class KeycloakOidcProvider implements AuthProvider {
  private readonly logger = new Logger(KeycloakOidcProvider.name);
  private readonly jwksClient: jwksRsa.JwksClient;
  private readonly keycloakIssuer: string;
  private readonly keycloakClientId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly localProvider: LocalAuthProvider,
  ) {
    this.keycloakIssuer = this.config.get<string>(
      'KEYCLOAK_ISSUER_URL',
      'http://localhost:8081/realms/e-office',
    );
    this.keycloakClientId = this.config.get<string>(
      'KEYCLOAK_CLIENT_ID',
      'eoffice-web',
    );

    this.jwksClient = jwksRsa({
      jwksUri: `${this.keycloakIssuer}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  // ── Dual-Auth delegate methods (Local credentials) ─────────────────────────

  register(input: RegisterInput): Promise<AuthResult> {
    return this.localProvider.register(input);
  }

  login(input: LoginInput): Promise<AuthResult> {
    return this.localProvider.login(input);
  }

  refresh(input: RefreshInput): Promise<AuthResult> {
    return this.localProvider.refresh(input);
  }

  logout(input: LogoutInput): Promise<void> {
    return this.localProvider.logout(input);
  }

  // ── Keycloak SSO methods ───────────────────────────────────────────────────

  getSsoConfig() {
    return {
      enabled: true,
      provider: 'keycloak',
      issuer: this.keycloakIssuer,
      clientId: this.keycloakClientId,
      authUrl: `${this.keycloakIssuer}/protocol/openid-connect/auth`,
      tokenUrl: `${this.keycloakIssuer}/protocol/openid-connect/token`,
      logoutUrl: `${this.keycloakIssuer}/protocol/openid-connect/logout`,
    };
  }

  async exchangeSsoToken(input: SsoExchangeInput): Promise<AuthResult> {
    if (!input.accessToken) {
      throw new UnauthorizedException('Access token is required');
    }

    // 1. Decode header to extract kid
    const decoded = jwt.decode(input.accessToken, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
      throw new UnauthorizedException('Invalid JWT structure or missing kid');
    }

    // 2. Fetch public key from Keycloak JWKS endpoint
    let signingKey: string;
    try {
      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      signingKey = key.getPublicKey();
    } catch (err) {
      this.logger.error(`Failed to retrieve JWKS signing key: ${err}`);
      throw new UnauthorizedException('Unable to verify Keycloak token signature');
    }

    // 3. Verify token signature and claims
    let payload: any;
    try {
      payload = jwt.verify(input.accessToken, signingKey, {
        algorithms: ['RS256'],
      });
    } catch (err: any) {
      this.logger.error(`Keycloak JWT verification failed: ${err.message}`);
      throw new UnauthorizedException(`Token verification failed: ${err.message}`);
    }

    // 4. Extract claims
    const sub: string = payload.sub;
    const email: string = (payload.email || payload.preferred_username || '').toLowerCase();
    if (!email) {
      throw new UnauthorizedException('Token missing email/username claim');
    }

    const displayName: string | null =
      payload.name || payload.preferred_username || payload.given_name || email;
    const department: string | null = payload.department || null;
    const title: string | null = payload.jobTitle || null;

    const realmRoles: string[] = Array.isArray(payload.realm_access?.roles)
      ? payload.realm_access.roles.map((r: string) => r.toLowerCase().trim())
      : [];
    const systemRole = realmRoles.includes('admin') ? 'admin' : 'user';

    // 5. Upsert User in e-Office database
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ keycloakSub: sub }, { email }],
      },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          keycloakSub: sub,
          displayName: displayName || user.displayName,
          department: department || user.department,
          title: title || user.title,
          role: systemRole === 'admin' ? 'admin' : user.role,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          keycloakSub: sub,
          displayName,
          department,
          title,
          role: systemRole,
          passwordHash: null,
        },
      });
    }

    // 6. Sync department into Organization tree if present
    if (department) {
      try {
        let org = await this.prisma.organization.findFirst({
          where: { name: department },
        });

        if (!org) {
          const orgId = randomUUID();
          org = await this.prisma.organization.create({
            data: {
              id: orgId,
              name: department,
              type: 'department',
              rootId: orgId,
            },
          });
        }

        const existingMembership = await this.prisma.organizationMember.findFirst({
          where: {
            userId: user.id,
            organizationId: org.id,
          },
        });

        if (!existingMembership) {
          await this.prisma.organizationMember.create({
            data: {
              userId: user.id,
              organizationId: org.id,
              role: systemRole === 'admin' ? 'manager' : 'member',
            },
          });
        }
      } catch (orgErr) {
        this.logger.warn(`Failed to auto-sync organization for department "${department}": ${orgErr}`);
      }
    }

    // 7. Issue e-Office access & refresh tokens
    const subject = {
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      department: user.department,
      title: user.title,
    };

    const tokens = await this.tokens.issueTokenPair(subject, input.deviceId);
    await this.tokens.cacheSession(subject);

    return { user: subject, tokens };
  }
}

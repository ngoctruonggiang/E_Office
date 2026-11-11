import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/prisma/prisma.module';
import { RedisModule } from './core/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { FormBuilderModule } from './modules/form-builder/form-builder.module';
import { RequestModule } from './modules/request/request.module';
import { ApprovalFlowModule } from './modules/approval-flow/approval-flow.module';
import { DocumentModule } from './modules/document/document.module';
import { CommentModule } from './modules/comment/comment.module';
import { SigningModule } from './modules/signing/signing.module';
import { SignatureModule } from './modules/signature/signature.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './core/common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Baseline in-process rate limiting for the whole app, keyed per client IP
    // (app trusts the proxy, so this is effectively per-user). Sized for an
    // interactive dashboard at scale (~1000 concurrent users); auth endpoints
    // add a stricter, distributed Redis limit on top (see RedisThrottleGuard).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('THROTTLE_TTL', 60)) * 1000, // ms in v6
            limit: Number(config.get('THROTTLE_LIMIT', 1000)),
          },
        ],
      }),
    }),

    PrismaModule,
    RedisModule,
    AuthModule,
    UserModule,
    OrganizationModule,
    FormBuilderModule,
    ApprovalFlowModule,
    RequestModule,
    DocumentModule,
    CommentModule,
    SigningModule,
    SignatureModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Deny-by-default: every route needs a valid JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Framework-level throttling on top of route-specific Redis limits.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Consistent error envelope + no stack-trace leakage.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

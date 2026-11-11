import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/core/prisma/prisma.service';
import { RedisThrottleGuard } from '../../src/modules/auth/guards/redis-throttle.guard';

/**
 * Shared e2e bootstrap.
 *
 * The real {@link JwtAuthGuard} is kept (auth is part of what we exercise), but
 * the two rate limiters are stubbed out so a suite can register the 10 users
 * the flows need without tripping the 5/min register cap. The global
 * ValidationPipe mirrors `main.ts` so DTO behaviour matches production.
 *
 * Requires a reachable Postgres (DATABASE_URL) and Redis — these are full
 * integration tests, not mocked unit tests.
 */
const passThroughGuard = { canActivate: (): boolean => true };

// Lift the in-memory throttler ceiling for the whole test process. The global
// ThrottlerGuard is bound via APP_GUARD (useClass), which `overrideGuard` does
// NOT reliably replace; raising the configured limit before ConfigModule reads
// it is the dependable lever (dotenv won't clobber an already-set env var).
// The per-route Redis limiter is still neutralised via overrideGuard below.
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT ?? '1000000';
process.env.THROTTLE_TTL = process.env.THROTTLE_TTL ?? '60';

export async function createTestApp(): Promise<INestApplication<App>> {
  process.env.THROTTLE_LIMIT = '1000000';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(passThroughGuard)
    .overrideGuard(RedisThrottleGuard)
    .useValue(passThroughGuard)
    .compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

/** Pull the live PrismaService out of an initialised app (assertions/cleanup). */
export function getPrisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the proxy so req.ip is the real client IP behind a load balancer
  // (important for the Redis rate limiter to key correctly).
  app.set('trust proxy', 1);

  // Raise the JSON body limit above the 100kb express default: signature images
  // are sent inline as base64 data URLs (PUT /users/me, signature payloads),
  // which can run to a couple of MB once base64-inflated.
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true });

  // Global input validation for every DTO across the app.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // 400 on unexpected properties
      transform: true, // coerce payloads into DTO instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Allowed browser origins. Defaults to the local dev ports; in deployed
  // environments set CORS_ORIGINS to a comma-separated list of frontend URLs
  // (e.g. https://frontend.s2.ttpprojects.com).
  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,https://frontend.s2.ttpprojects.com, https://frontend-test.s2.ttpprojects.com'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Graceful shutdown so Redis/Prisma connections close cleanly.
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Gafood API')
    .setDescription('API documentation for the Gafood backend')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste the access token returned by POST /auth/login',
      in: 'header',
    })
    .addTag('auth', 'Register, login, refresh and logout')
    .addTag('users', 'Authenticated user profile + admin account management')
    .addTag('organizations', 'Organization tree + HR (root-scoped membership)')
    .addTag('forms', 'Form builder — request templates')
    .addTag('requests', 'Filled-in forms and their approval lifecycle')
    .addTag('approval-flows', "Read-only view of a request's approval progress")
    .addTag('documents', 'File uploads attached to requests')
    .addTag('signing', 'Online document signing bridged to Documenso')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 8080);
}
void bootstrap();

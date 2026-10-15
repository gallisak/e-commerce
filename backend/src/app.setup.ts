import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { REFRESH_TOKEN_COOKIE } from './auth/auth.constants.js';
import { httpLoggerMiddleware } from './common/logging/http-logger.middleware.js';
import { REQUEST_ID_HEADER, requestContextMiddleware } from './common/logging/request-context.js';
import type { EnvironmentVariables } from './config/env.validation.js';
import { UPLOADS_URL_PREFIX } from './storage/image-storage.service.js';

export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  const trustedProxies = config.get('TRUST_PROXY', { infer: true });
  if (trustedProxies > 0) app.set('trust proxy', trustedProxies);
  app.setGlobalPrefix('api');
  app.use(requestContextMiddleware);
  app.use(httpLoggerMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.useStaticAssets(resolve(config.get('UPLOAD_DIR', { infer: true })), {
    prefix: UPLOADS_URL_PREFIX,
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
  });
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
    exposedHeaders: [
      REQUEST_ID_HEADER,
      'Content-Disposition',
      'Retry-After-login',
      'Retry-After-default',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mini Marketplace API')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_TOKEN_COOKIE)
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: { persistAuthorization: true },
  });
}

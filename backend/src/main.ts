import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppLogger } from './common/logging/app-logger.js';
import { type EnvironmentVariables, LogFormat } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  app.useLogger(
    new AppLogger({
      level: config.get('LOG_LEVEL', { infer: true }),
      json: config.get('LOG_FORMAT', { infer: true }) === LogFormat.Json,
    }),
  );

  const logger = new Logger('Process');
  process.on('unhandledRejection', (reason) => {
    logger.error(
      `Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      reason instanceof Error ? reason.stack : undefined,
    );
  });
  process.on('uncaughtException', (error) => {
    logger.fatal(`Uncaught exception: ${error.message}`, error.stack);
    process.exit(1);
  });

  configureApp(app);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();

import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { REDIS_CLIENT } from './redis.constants.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<EnvironmentVariables, true>) => {
        const logger = new Logger('Redis');
        const client = new Redis({
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          db: config.get('REDIS_DB', { infer: true }),
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        });

        let available = true;
        client.on('error', (error) => {
          if (!available) return;
          available = false;
          logger.error(`Redis unavailable: ${error.message}`);
        });
        client.on('ready', () => {
          if (available) return;
          available = true;
          logger.log('Redis connection restored');
        });

        await client.connect().catch((error: Error) => {
          logger.warn(`Starting without Redis (${error.message}); will keep reconnecting`);
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}

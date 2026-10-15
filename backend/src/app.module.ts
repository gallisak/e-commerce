import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { AuthModule } from './auth/auth.module.js';
import { CartModule } from './cart/cart.module.js';
import { CatalogCacheModule } from './catalog-cache/catalog-cache.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { LOGIN_RATE_LIMIT_KEY } from './common/decorators/login-rate-limit.decorator.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage.js';
import { type EnvironmentVariables, validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';
import { REDIS_CLIENT } from './redis/redis.constants.js';
import { RedisModule } from './redis/redis.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    DatabaseModule,
    RedisModule,
    CatalogCacheModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        prefix: config.get('QUEUE_PREFIX', { infer: true }),
        connection: {
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT, Reflector],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        redis: Redis,
        reflector: Reflector,
      ) => ({
        storage: new RedisThrottlerStorage(redis),
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
          {
            name: 'login',
            ttl: config.get('LOGIN_THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('LOGIN_THROTTLE_LIMIT', { infer: true }),
            skipIf: (context) =>
              !reflector.get<boolean>(LOGIN_RATE_LIMIT_KEY, context.getHandler()),
          },
        ],
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

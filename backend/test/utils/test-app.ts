import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as argon2 from 'argon2';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { Role } from '../../src/generated/prisma/client.js';
import { REDIS_CLIENT } from '../../src/redis/redis.constants.js';

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  redis: Redis;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();

  const context = { app, prisma: app.get(PrismaService), redis: app.get<Redis>(REDIS_CLIENT) };
  await resetThrottling(context.redis);
  return context;
}

export async function resetThrottling(redis: Redis): Promise<void> {
  const keys = await redis.keys('throttler:*');
  if (keys.length) await redis.del(...keys);
}

export const uniqueEmail = (prefix = 'e2e') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

export async function createUserAndLogin(
  ctx: TestContext,
  role: Role = Role.CUSTOMER,
): Promise<{ id: string; email: string; accessToken: string }> {
  const email = uniqueEmail(role.toLowerCase());
  const password = 'Secret123';
  const user = await ctx.prisma.user.create({
    data: { email, name: `E2E ${role}`, role, passwordHash: await argon2.hash(password) },
  });
  const res = await request(ctx.app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  await resetThrottling(ctx.redis);
  return { id: user.id, email, accessToken: res.body.accessToken as string };
}

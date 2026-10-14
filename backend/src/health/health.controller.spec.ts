import { ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { PrismaService } from '../database/prisma.service.js';
import { HealthController } from './health.controller.js';

const ok = () => Promise.resolve('ok');
const fail = () => Promise.reject(new Error('connection refused'));

describe('HealthController', () => {
  const makeController = (db: () => Promise<unknown>, redis: () => Promise<unknown>) =>
    new HealthController(
      { $queryRaw: db } as unknown as PrismaService,
      { ping: redis } as unknown as Redis,
    );

  it('reports ok when all dependencies respond', async () => {
    await expect(makeController(ok, ok).check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      redis: 'up',
    });
  });

  it('reports degraded but stays available when only Redis is down', async () => {
    await expect(makeController(ok, fail).check()).resolves.toEqual({
      status: 'degraded',
      database: 'up',
      redis: 'down',
    });
  });

  it('throws 503 when the database is unreachable', async () => {
    await expect(makeController(fail, ok).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

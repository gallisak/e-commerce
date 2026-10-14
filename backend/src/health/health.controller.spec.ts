import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../database/prisma.service.js';

describe('HealthController', () => {
  const makeController = (queryRaw: () => Promise<unknown>) =>
    new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);

  it('reports ok when the database responds', async () => {
    const controller = makeController(() => Promise.resolve([{ '?column?': 1 }]));
    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('throws 503 when the database is unreachable', async () => {
    const controller = makeController(() => Promise.reject(new Error('connection refused')));
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

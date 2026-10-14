import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

type ComponentStatus = 'up' | 'down';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: ComponentStatus;
  redis: ComponentStatus;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(() => this.redis.ping()),
    ]);
    if (database === 'down') {
      throw new ServiceUnavailableException({ status: 'error', database, redis });
    }
    return { status: redis === 'up' ? 'ok' : 'degraded', database, redis };
  }

  private async probe(check: () => Promise<unknown>): Promise<ComponentStatus> {
    try {
      await check();
      return 'up';
    } catch {
      return 'down';
    }
  }
}

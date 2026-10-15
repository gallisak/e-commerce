import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

export interface CacheResult<T> {
  value: T;
  hit: boolean;
}

const VERSION_KEY = 'catalog:version';

@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);
  private readonly ttlSeconds: number;
  private pendingInvalidation = false;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlSeconds = config.get('CATALOG_CACHE_TTL_SECONDS', { infer: true });
    this.redis.on('ready', () => {
      if (this.pendingInvalidation) void this.invalidate('missed while Redis was unavailable');
    });
  }

  async getOrSet<T>(
    scope: string,
    params: unknown,
    loader: () => Promise<T>,
  ): Promise<CacheResult<T>> {
    let key: string | undefined;
    try {
      key = await this.buildKey(scope, params);
      const cached = await this.redis.get(key);
      if (cached !== null) return { value: JSON.parse(cached) as T, hit: true };
    } catch (error) {
      this.logger.warn(`Cache read failed, falling back to database: ${(error as Error).message}`);
    }

    const value = await loader();
    if (key) {
      await this.redis
        .set(key, JSON.stringify(value), 'EX', this.ttlSeconds)
        .catch((error: Error) => this.logger.warn(`Cache write failed: ${error.message}`));
    }
    return { value, hit: false };
  }

  async invalidate(reason: string): Promise<void> {
    try {
      const version = await this.redis.incr(VERSION_KEY);
      this.pendingInvalidation = false;
      this.logger.log(`Catalog cache invalidated (${reason}), version=${version}`);
    } catch (error) {
      this.pendingInvalidation = true;
      this.logger.error(
        `Catalog cache invalidation failed, will retry on reconnect: ${(error as Error).message}`,
      );
    }
  }

  private async buildKey(scope: string, params: unknown): Promise<string> {
    const version = (await this.redis.get(VERSION_KEY)) ?? '0';
    const hash = createHash('sha1').update(stableStringify(params)).digest('hex');
    return `catalog:v${version}:${scope}:${hash}`;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

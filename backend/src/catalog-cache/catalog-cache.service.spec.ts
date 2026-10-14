import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { CatalogCacheService } from './catalog-cache.service.js';

class FakeRedis {
  store = new Map<string, string>();
  ttl = new Map<string, number>();
  failing = false;

  async get(key: string) {
    if (this.failing) throw new Error('connection lost');
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _mode: string, ttl: number) {
    if (this.failing) throw new Error('connection lost');
    this.store.set(key, value);
    this.ttl.set(key, ttl);
    return 'OK';
  }

  async incr(key: string) {
    if (this.failing) throw new Error('connection lost');
    const next = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(next));
    return next;
  }
}

describe('CatalogCacheService', () => {
  let redis: FakeRedis;
  let cache: CatalogCacheService;

  beforeEach(() => {
    redis = new FakeRedis();
    const config = { get: () => 120 } as unknown as ConfigService<EnvironmentVariables, true>;
    cache = new CatalogCacheService(redis as unknown as Redis, config);
  });

  it('loads on miss, stores with TTL and serves the next call from cache', async () => {
    const loader = vi.fn().mockResolvedValue({ items: [1, 2] });

    await expect(cache.getOrSet('products:list', { page: 1 }, loader)).resolves.toEqual({
      value: { items: [1, 2] },
      hit: false,
    });
    await expect(cache.getOrSet('products:list', { page: 1 }, loader)).resolves.toEqual({
      value: { items: [1, 2] },
      hit: true,
    });
    expect(loader).toHaveBeenCalledTimes(1);
    expect([...redis.ttl.values()]).toEqual([120]);
  });

  it('builds the same key regardless of property order and ignores undefined values', async () => {
    const loader = vi.fn().mockResolvedValue('value');
    await cache.getOrSet('products:list', { page: 1, sort: 'newest', search: undefined }, loader);
    const second = await cache.getOrSet('products:list', { sort: 'newest', page: 1 }, loader);

    expect(second.hit).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('separates entries by scope and params', async () => {
    const loader = vi.fn().mockResolvedValue('value');
    await cache.getOrSet('products:list', { page: 1 }, loader);
    await cache.getOrSet('products:list', { page: 2 }, loader);
    await cache.getOrSet('products:item', { page: 1 }, loader);

    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('makes previously cached entries unreachable after invalidation', async () => {
    const loader = vi.fn().mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh');
    await cache.getOrSet('products:item', { id: '1' }, loader);

    await cache.invalidate('product updated');

    await expect(cache.getOrSet('products:item', { id: '1' }, loader)).resolves.toEqual({
      value: 'fresh',
      hit: false,
    });
  });

  it('falls back to the loader when Redis is unavailable', async () => {
    redis.failing = true;
    const loader = vi.fn().mockResolvedValue('from-db');

    await expect(cache.getOrSet('categories', {}, loader)).resolves.toEqual({
      value: 'from-db',
      hit: false,
    });
    await expect(cache.invalidate('test')).resolves.toBeUndefined();
  });
});

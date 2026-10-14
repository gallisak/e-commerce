import { Redis } from 'ioredis';
import { RedisThrottlerStorage } from '../src/common/throttler/redis-throttler.storage.js';

describe('RedisThrottlerStorage (integration)', () => {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  });
  const storage = new RedisThrottlerStorage(redis, `throttler-test-${Date.now()}`);

  afterAll(async () => {
    const keys = await redis.keys('throttler-test-*');
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  it('counts hits within the window and blocks once the limit is exceeded', async () => {
    const results = [];
    for (let i = 0; i < 4; i++)
      results.push(await storage.increment('ip-1', 60_000, 3, 30_000, 'default'));

    expect(results.map((r) => r.totalHits)).toEqual([1, 2, 3, 4]);
    expect(results.map((r) => r.isBlocked)).toEqual([false, false, false, true]);
    expect(results[3].timeToBlockExpire).toBe(30);
    expect(results[0].timeToExpire).toBeGreaterThan(0);
  });

  it('keeps blocking without counting further hits while blocked', async () => {
    for (let i = 0; i < 3; i++) await storage.increment('ip-2', 60_000, 2, 30_000, 'default');
    const blocked = await storage.increment('ip-2', 60_000, 2, 30_000, 'default');
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.totalHits).toBe(3);
  });

  it('tracks throttlers and keys independently', async () => {
    await storage.increment('ip-3', 60_000, 1, 30_000, 'login');
    const other = await storage.increment('ip-3', 60_000, 1, 30_000, 'default');
    const otherKey = await storage.increment('ip-4', 60_000, 1, 30_000, 'login');
    expect(other.isBlocked).toBe(false);
    expect(otherKey.isBlocked).toBe(false);
  });

  it('resets the counter after the window expires', async () => {
    await storage.increment('ip-5', 50, 1, 50, 'default');
    await storage.increment('ip-5', 50, 1, 50, 'default');
    await new Promise((resolve) => setTimeout(resolve, 120));
    const fresh = await storage.increment('ip-5', 50, 1, 50, 'default');
    expect(fresh).toMatchObject({ totalHits: 1, isBlocked: false });
  });
});

import type { Redis } from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

describe('RedisThrottlerStorage', () => {
  it('fails open when Redis is unavailable so the API stays reachable', async () => {
    const redis = { eval: vi.fn().mockRejectedValue(new Error('Connection is closed.')) };
    const storage = new RedisThrottlerStorage(redis as unknown as Redis);

    await expect(storage.increment('ip', 60_000, 5, 60_000, 'login')).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('maps the Lua script result to seconds', async () => {
    const redis = { eval: vi.fn().mockResolvedValue([6, 42_100, 1, 30_000]) };
    const storage = new RedisThrottlerStorage(redis as unknown as Redis);

    await expect(storage.increment('ip', 60_000, 5, 30_000, 'login')).resolves.toEqual({
      totalHits: 6,
      timeToExpire: 43,
      isBlocked: true,
      timeToBlockExpire: 30,
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'throttler:login:ip:hits',
      'throttler:login:ip:blocked',
      60_000,
      5,
      30_000,
    );
  });
});

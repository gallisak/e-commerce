import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { OrdersRepository } from '../orders.repository.js';
import { OrderRecoveryService } from './order-recovery.service.js';
import type { OrdersQueueService } from './orders-queue.service.js';

describe('OrderRecoveryService', () => {
  const setup = (ids: string[]) => {
    const repo = {
      findStaleNewOrderIds: vi.fn().mockResolvedValue(ids),
      findPendingRefundIds: vi.fn().mockResolvedValue([]),
    };
    const queue = {
      enqueueProcessing: vi.fn().mockResolvedValue(true),
      enqueueRefund: vi.fn().mockResolvedValue(true),
    };
    const config = { get: () => 0 } as unknown as ConfigService<EnvironmentVariables, true>;
    const service = new OrderRecoveryService(
      repo as unknown as OrdersRepository,
      queue as unknown as OrdersQueueService,
      config,
    );
    return { repo, queue, service };
  };

  it('re-enqueues NEW orders that were not processed in time', async () => {
    const { repo, queue, service } = setup(['o-1', 'o-2']);

    await expect(service.requeueStaleOrders()).resolves.toBe(2);

    const [olderThan] = repo.findStaleNewOrderIds.mock.calls[0] as [Date];
    expect(Date.now() - olderThan.getTime()).toBeGreaterThanOrEqual(2 * 60 * 1000 - 1000);
    expect(queue.enqueueProcessing.mock.calls).toEqual([['o-1'], ['o-2']]);
  });

  it('does nothing when the interval is disabled', () => {
    const { repo, service } = setup([]);
    service.onApplicationBootstrap();
    service.onApplicationShutdown();
    expect(repo.findStaleNewOrderIds).not.toHaveBeenCalled();
  });

  it('swallows database errors so the timer keeps running', async () => {
    const { repo, service } = setup([]);
    repo.findStaleNewOrderIds.mockRejectedValue(new Error('db down'));
    await expect(service.requeueStaleOrders()).resolves.toBe(0);
  });
});

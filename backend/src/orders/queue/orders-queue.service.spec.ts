import type { Queue } from 'bullmq';
import { PROCESS_ORDER_JOB, type ProcessOrderJobData } from './orders-queue.constants.js';
import { ENQUEUE_TIMEOUT_MS, OrdersQueueService } from './orders-queue.service.js';

describe('OrdersQueueService', () => {
  const makeQueue = (job?: unknown) => ({
    getJob: vi.fn().mockResolvedValue(job),
    add: vi.fn(),
    on: vi.fn(),
  });
  const create = (queue: ReturnType<typeof makeQueue>) =>
    new OrdersQueueService(queue as unknown as Queue<ProcessOrderJobData>);

  it('adds a job keyed by order id with retries and backoff', async () => {
    const queue = makeQueue();
    await expect(create(queue).enqueueProcessing('order-1')).resolves.toBe(true);

    expect(queue.add).toHaveBeenCalledWith(
      PROCESS_ORDER_JOB,
      { orderId: 'order-1' },
      expect.objectContaining({
        jobId: 'order-1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
  });

  it('does not duplicate a job that is already queued', async () => {
    const queue = makeQueue({ isFailed: vi.fn().mockResolvedValue(false), retry: vi.fn() });
    await create(queue).enqueueProcessing('order-1');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('retries a job that has exhausted its attempts', async () => {
    const job = { isFailed: vi.fn().mockResolvedValue(true), retry: vi.fn() };
    const queue = makeQueue(job);
    await create(queue).enqueueProcessing('order-1');
    expect(job.retry).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('reports failure instead of throwing when Redis is unavailable', async () => {
    const queue = makeQueue();
    queue.getJob.mockRejectedValue(new Error('Connection is closed.'));
    await expect(create(queue).enqueueProcessing('order-1')).resolves.toBe(false);
  });

  it('gives up after a timeout instead of blocking checkout when Redis hangs', async () => {
    const queue = makeQueue();
    queue.getJob.mockReturnValue(new Promise(() => undefined));

    const startedAt = Date.now();
    await expect(create(queue).enqueueProcessing('order-1')).resolves.toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(ENQUEUE_TIMEOUT_MS + 500);
  });
});

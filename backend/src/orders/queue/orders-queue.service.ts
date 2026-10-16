import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ORDERS_QUEUE,
  PROCESS_ORDER_JOB,
  type ProcessOrderJobData,
  REFUND_ORDER_JOB,
} from './orders-queue.constants.js';

export const ENQUEUE_TIMEOUT_MS = 2000;
const JOB_LABELS: Record<string, string> = {
  [PROCESS_ORDER_JOB]: 'Order processing job',
  [REFUND_ORDER_JOB]: 'Refund job',
};
const ERROR_LOG_INTERVAL_MS = 10_000;

@Injectable()
export class OrdersQueueService implements OnModuleInit {
  private readonly logger = new Logger(OrdersQueueService.name);
  private lastErrorLoggedAt = 0;

  constructor(@InjectQueue(ORDERS_QUEUE) private readonly queue: Queue<ProcessOrderJobData>) {}

  onModuleInit(): void {
    this.queue.on('error', (error: Error) => {
      const now = Date.now();
      if (now - this.lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) return;
      this.lastErrorLoggedAt = now;
      this.logger.error(`Orders queue connection error: ${error.message}`);
    });
  }

  enqueueProcessing(orderId: string): Promise<boolean> {
    return this.enqueue(PROCESS_ORDER_JOB, orderId, orderId);
  }

  enqueueRefund(orderId: string): Promise<boolean> {
    return this.enqueue(REFUND_ORDER_JOB, `refund-${orderId}`, orderId);
  }

  private async enqueue(name: string, jobId: string, orderId: string): Promise<boolean> {
    const deadline = new AbortController();
    try {
      await Promise.race([
        this.ensureJob(name, jobId, orderId),
        rejectAfter(ENQUEUE_TIMEOUT_MS, deadline.signal),
      ]);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue ${JOB_LABELS[name].toLowerCase()} for order ${orderId}, recovery will retry: ${(error as Error).message}`,
      );
      return false;
    } finally {
      deadline.abort();
    }
  }

  private async ensureJob(name: string, jobId: string, orderId: string): Promise<void> {
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      if (await existing.isFailed()) {
        await existing.retry();
        this.logger.log(`${JOB_LABELS[name]} retried: ${orderId}`);
      }
      return;
    }
    await this.queue.add(
      name,
      { orderId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    );
    this.logger.log(`${JOB_LABELS[name]} enqueued: ${orderId}`);
  }
}

function rejectAfter(ms: number, signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  });
}

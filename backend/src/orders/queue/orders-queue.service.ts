import { setTimeout as sleep } from 'node:timers/promises';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ORDERS_QUEUE,
  PROCESS_ORDER_JOB,
  type ProcessOrderJobData,
} from './orders-queue.constants.js';

export const ENQUEUE_TIMEOUT_MS = 2000;
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

  async enqueueProcessing(orderId: string): Promise<boolean> {
    try {
      return await Promise.race([
        this.ensureJob(orderId).then(() => true),
        sleep(ENQUEUE_TIMEOUT_MS).then(() => {
          throw new Error(`timed out after ${ENQUEUE_TIMEOUT_MS} ms`);
        }),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue order ${orderId}, recovery will retry: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async ensureJob(orderId: string): Promise<void> {
    const existing = await this.queue.getJob(orderId);
    if (existing) {
      if (await existing.isFailed()) {
        await existing.retry();
        this.logger.log(`Order processing job retried: ${orderId}`);
      }
      return;
    }
    await this.queue.add(
      PROCESS_ORDER_JOB,
      { orderId },
      {
        jobId: orderId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    );
    this.logger.log(`Order processing job enqueued: ${orderId}`);
  }
}

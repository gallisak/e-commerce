import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { OrdersRepository } from '../orders.repository.js';
import { OrdersQueueService } from './orders-queue.service.js';

const STALE_AFTER_MS = 2 * 60 * 1000;
const BATCH_SIZE = 100;

@Injectable()
export class OrderRecoveryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OrderRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly ordersQueue: OrdersQueueService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onApplicationBootstrap(): void {
    const intervalSeconds = this.config.get('ORDER_RECOVERY_INTERVAL_SECONDS', { infer: true });
    if (intervalSeconds === 0) return;
    this.timer = setInterval(() => void this.requeueStaleOrders(), intervalSeconds * 1000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async requeueStaleOrders(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
      const ids = await this.ordersRepository.findStaleNewOrderIds(staleBefore, BATCH_SIZE);
      for (const id of ids) await this.ordersQueue.enqueueProcessing(id);
      if (ids.length > 0) this.logger.warn(`Re-enqueued ${ids.length} stale NEW order(s)`);

      const refundIds = await this.ordersRepository.findPendingRefundIds(staleBefore, BATCH_SIZE);
      for (const id of refundIds) await this.ordersQueue.enqueueRefund(id);
      if (refundIds.length > 0) {
        this.logger.warn(`Re-enqueued ${refundIds.length} pending refund(s)`);
      }
      return ids.length + refundIds.length;
    } catch (error) {
      this.logger.error(`Order recovery failed: ${(error as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}

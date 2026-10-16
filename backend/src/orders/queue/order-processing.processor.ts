import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { OrdersService } from '../orders.service.js';
import {
  ORDERS_QUEUE,
  type ProcessOrderJobData,
  REFUND_ORDER_JOB,
} from './orders-queue.constants.js';

@Processor(ORDERS_QUEUE, { concurrency: 5 })
export class OrderProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessingProcessor.name);
  private lastConnectionErrorAt = 0;

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  async process(job: Job<ProcessOrderJobData>): Promise<void> {
    if (job.name === REFUND_ORDER_JOB) {
      this.logger.log(`Refunding order ${job.data.orderId} (attempt ${job.attemptsMade + 1})`);
      await this.ordersService.refundPayment(job.data.orderId);
      return;
    }
    this.logger.log(`Processing order ${job.data.orderId} (attempt ${job.attemptsMade + 1})`);
    await this.ordersService.processPayment(job.data.orderId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessOrderJobData> | undefined, error: Error): void {
    this.logger.error(
      `Order job ${job?.name ?? 'unknown'} failed: ${job?.data.orderId ?? 'unknown'} attempt ${job?.attemptsMade ?? '?'}: ${error.message}`,
    );
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    const now = Date.now();
    if (now - this.lastConnectionErrorAt < 10_000) return;
    this.lastConnectionErrorAt = now;
    this.logger.error(`Orders worker connection error: ${error.message}`);
  }
}

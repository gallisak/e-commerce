import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';

export type PaymentResult =
  { success: true; transactionId: string } | { success: false; reason: string };

@Injectable()
export class MockPaymentService {
  private readonly logger = new Logger(MockPaymentService.name);

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  async charge(orderId: string, amount: number): Promise<PaymentResult> {
    await sleep(this.config.get('PAYMENT_MOCK_DELAY_MS', { infer: true }));

    if (declineScore(orderId) < this.config.get('PAYMENT_MOCK_FAILURE_RATE', { infer: true })) {
      this.logger.warn(`Mock payment declined: order=${orderId} amount=${amount}`);
      return { success: false, reason: 'Payment declined (mock)' };
    }

    const transactionId = `mock_${orderId}`;
    this.logger.log(`Mock payment captured: order=${orderId} amount=${amount} tx=${transactionId}`);
    return { success: true, transactionId };
  }

  async refund(orderId: string, transactionId: string): Promise<void> {
    await sleep(this.config.get('PAYMENT_MOCK_DELAY_MS', { infer: true }));
    this.logger.warn(`Mock payment refunded: order=${orderId} tx=${transactionId}`);
  }
}

function declineScore(orderId: string): number {
  return createHash('sha256').update(orderId).digest().readUInt32BE(0) / 0x1_0000_0000;
}

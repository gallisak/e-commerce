import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { MockPaymentService } from './mock-payment.service.js';

const create = (failureRate: number) =>
  new MockPaymentService({
    get: (key: string) => (key === 'PAYMENT_MOCK_FAILURE_RATE' ? failureRate : 0),
  } as unknown as ConfigService<EnvironmentVariables, true>);

describe('MockPaymentService', () => {
  it('is idempotent per order: a retried charge returns the same transaction', async () => {
    const payments = create(0);
    const first = await payments.charge('order-1', 1000);
    const retry = await payments.charge('order-1', 1000);

    expect(first).toEqual({ success: true, transactionId: 'mock_order-1' });
    expect(retry).toEqual(first);
    expect(await payments.charge('order-2', 1000)).toEqual({
      success: true,
      transactionId: 'mock_order-2',
    });
  });

  it('declines the same orders every time for a given failure rate', async () => {
    const payments = create(0.5);
    const ids = Array.from({ length: 40 }, (_, index) => `order-${index}`);
    const first = await Promise.all(ids.map((id) => payments.charge(id, 1000)));
    const second = await Promise.all(ids.map((id) => payments.charge(id, 1000)));

    expect(second).toEqual(first);
    const declined = first.filter((result) => !result.success).length;
    expect(declined).toBeGreaterThan(5);
    expect(declined).toBeLessThan(35);
  });

  it('never declines with a zero failure rate and always declines with one', async () => {
    expect((await create(0).charge('order-x', 1)).success).toBe(true);
    expect(await create(1).charge('order-x', 1)).toEqual({
      success: false,
      reason: 'Payment declined (mock)',
    });
  });
});

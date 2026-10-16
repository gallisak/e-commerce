import { OrderStatus } from '../../generated/prisma/client.js';
import { OrderPaymentDto, PaymentStatus } from './order-response.dto.js';

const payment = (status: OrderStatus, paymentId: string | null, refundedAt: Date | null = null) =>
  OrderPaymentDto.fromEntity({ status, paymentId, refundedAt }).status;

describe('OrderPaymentDto', () => {
  it('derives the payment status from the order', () => {
    expect(payment(OrderStatus.NEW, null)).toBe(PaymentStatus.Pending);
    expect(payment(OrderStatus.CANCELLED, null)).toBe(PaymentStatus.NotPaid);
    expect(payment(OrderStatus.PROCESSING, 'tx')).toBe(PaymentStatus.Paid);
    expect(payment(OrderStatus.COMPLETED, 'tx')).toBe(PaymentStatus.Paid);
    expect(payment(OrderStatus.CANCELLED, 'tx')).toBe(PaymentStatus.RefundPending);
    expect(payment(OrderStatus.CANCELLED, 'tx', new Date())).toBe(PaymentStatus.Refunded);
  });

  it('exposes the transaction and refund time', () => {
    const refundedAt = new Date('2026-10-16T09:00:00Z');
    expect(
      OrderPaymentDto.fromEntity({ status: OrderStatus.CANCELLED, paymentId: 'tx-1', refundedAt }),
    ).toEqual({ status: PaymentStatus.Refunded, transactionId: 'tx-1', refundedAt });
  });
});

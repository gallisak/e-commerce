import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/types/auth-user.js';
import type { CatalogCacheService } from '../catalog-cache/catalog-cache.service.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { OrderStatus, Prisma, Role } from '../generated/prisma/client.js';
import type { OrdersRepository, OrderWithDetails } from './orders.repository.js';
import { MAX_ORDER_TOTAL, OrdersService } from './orders.service.js';
import type { MockPaymentService } from './payment/mock-payment.service.js';
import type { OrdersQueueService } from './queue/orders-queue.service.js';

const customer: AuthUser = { id: 'user-1', email: 'c@example.com', role: Role.CUSTOMER };
const admin: AuthUser = { id: 'admin-1', email: 'a@example.com', role: Role.ADMIN };
const TX = { tx: true };

const makeOrder = (overrides: Partial<OrderWithDetails> = {}): OrderWithDetails => ({
  id: 'order-1',
  userId: customer.id,
  status: OrderStatus.NEW,
  totalAmount: 25_000,
  shippingAddress: 'Kyiv',
  idempotencyKey: null,
  cancelReason: null,
  paymentId: null,
  refundedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 'i-1',
      orderId: 'order-1',
      productId: 'p-a',
      productName: 'A',
      unitPrice: 10_000,
      quantity: 2,
    },
    {
      id: 'i-2',
      orderId: 'order-1',
      productId: 'p-b',
      productName: 'B',
      unitPrice: 5_000,
      quantity: 1,
    },
  ],
  statusHistory: [],
  user: { id: customer.id, email: customer.email, name: 'Customer' },
  ...overrides,
});

describe('OrdersService', () => {
  let repo: Record<keyof OrdersRepository, ReturnType<typeof vi.fn>>;
  let queue: {
    enqueueProcessing: ReturnType<typeof vi.fn>;
    enqueueRefund: ReturnType<typeof vi.fn>;
  };
  let payments: { charge: ReturnType<typeof vi.fn>; refund: ReturnType<typeof vi.fn> };
  let cache: { invalidate: ReturnType<typeof vi.fn> };
  let service: OrdersService;
  let stock: Record<string, { name: string; price: number; stock: number }>;

  beforeEach(() => {
    stock = {
      'p-a': { name: 'A', price: 10_000, stock: 5 },
      'p-b': { name: 'B', price: 5_000, stock: 1 },
    };
    repo = {
      transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(TX)),
      findCartLines: vi.fn().mockResolvedValue([
        { productId: 'p-a', quantity: 2 },
        { productId: 'p-b', quantity: 1 },
      ]),
      reserveStock: vi.fn(async (_tx: unknown, productId: string, quantity: number) => {
        const product = stock[productId];
        if (!product || product.stock < quantity) return null;
        product.stock -= quantity;
        return { id: productId, name: product.name, price: product.price };
      }),
      releaseStock: vi.fn(),
      findProductStock: vi.fn(async (_tx: unknown, productId: string) =>
        stock[productId]
          ? { name: stock[productId].name, stock: stock[productId].stock, deletedAt: null }
          : null,
      ),
      createOrder: vi.fn(async (_tx: unknown, data: { totalAmount: number }) =>
        makeOrder({ totalAmount: data.totalAmount }),
      ),
      clearCart: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeOrder()),
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      search: vi.fn().mockResolvedValue([[], 0]),
      updateStatusIfCurrent: vi.fn().mockResolvedValue(true),
      addStatusHistory: vi.fn(),
      findStaleNewOrderIds: vi.fn(),
      findPendingRefundIds: vi.fn(),
      markRefunded: vi.fn().mockResolvedValue(true),
      lockCart: vi.fn(),
      attachPayment: vi.fn(),
    };
    queue = {
      enqueueProcessing: vi.fn().mockResolvedValue(true),
      enqueueRefund: vi.fn().mockResolvedValue(true),
    };
    payments = {
      charge: vi.fn().mockResolvedValue({ success: true, transactionId: 'tx-1' }),
      refund: vi.fn(),
    };
    cache = { invalidate: vi.fn() };
    service = new OrdersService(
      repo as unknown as OrdersRepository,
      queue as unknown as OrdersQueueService,
      payments as unknown as MockPaymentService,
      cache as unknown as CatalogCacheService,
      { get: () => 'Europe/Kyiv' } as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  describe('checkout: stock reservation', () => {
    it('locks the cart before reading it so parallel checkouts cannot both order it', async () => {
      await service.checkout(customer, { shippingAddress: 'Kyiv' });

      expect(repo.lockCart).toHaveBeenCalledWith(TX, customer.id);
      expect(repo.lockCart.mock.invocationCallOrder[0]).toBeLessThan(
        repo.findCartLines.mock.invocationCallOrder[0],
      );
    });

    it('reserves every line inside one transaction and snapshots prices', async () => {
      const result = await service.checkout(customer, { shippingAddress: 'Kyiv' });

      expect(repo.transaction).toHaveBeenCalledTimes(1);
      expect(repo.reserveStock).toHaveBeenNthCalledWith(1, TX, 'p-a', 2);
      expect(repo.reserveStock).toHaveBeenNthCalledWith(2, TX, 'p-b', 1);
      expect(repo.createOrder).toHaveBeenCalledWith(TX, {
        userId: customer.id,
        shippingAddress: 'Kyiv',
        idempotencyKey: null,
        totalAmount: 25_000,
        items: [
          { productId: 'p-a', productName: 'A', unitPrice: 10_000, quantity: 2 },
          { productId: 'p-b', productName: 'B', unitPrice: 5_000, quantity: 1 },
        ],
      });
      expect(repo.clearCart).toHaveBeenCalledWith(TX, customer.id);
      expect(stock['p-a'].stock).toBe(3);
      expect(stock['p-b'].stock).toBe(0);
      expect(result.replayed).toBe(false);
    });

    it('invalidates the catalog cache and enqueues processing only after commit', async () => {
      const calls: string[] = [];
      repo.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const value = await fn(TX);
        calls.push('commit');
        return value;
      });
      cache.invalidate.mockImplementation(async () => calls.push('invalidate'));
      queue.enqueueProcessing.mockImplementation(async () => calls.push('enqueue'));

      await service.checkout(customer, { shippingAddress: 'Kyiv' });

      expect(calls).toEqual(['commit', 'invalidate', 'enqueue']);
      expect(queue.enqueueProcessing).toHaveBeenCalledWith('order-1');
    });

    it('rejects the whole order when any line lacks stock and reports every shortage', async () => {
      stock['p-b'].stock = 0;
      repo.findCartLines.mockResolvedValue([
        { productId: 'p-a', quantity: 2 },
        { productId: 'p-b', quantity: 1 },
        { productId: 'p-missing', quantity: 1 },
      ]);

      const error = await service.checkout(customer, { shippingAddress: 'Kyiv' }).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        items: [
          { productId: 'p-b', name: 'B', requested: 1, available: 0 },
          { productId: 'p-missing', name: 'Unknown product', requested: 1, available: 0 },
        ],
      });
      expect(repo.createOrder).not.toHaveBeenCalled();
      expect(repo.clearCart).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
      expect(queue.enqueueProcessing).not.toHaveBeenCalled();
    });

    it('rejects an empty cart without touching stock', async () => {
      repo.findCartLines.mockResolvedValue([]);
      await expect(service.checkout(customer, { shippingAddress: 'Kyiv' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.reserveStock).not.toHaveBeenCalled();
    });

    it('rejects totals that do not fit the database column', async () => {
      stock['p-a'] = { name: 'A', price: 100_000_000, stock: 99 };
      repo.findCartLines.mockResolvedValue([{ productId: 'p-a', quantity: 99 }]);

      await expect(service.checkout(customer, { shippingAddress: 'Kyiv' })).rejects.toThrow(
        'Order total exceeds the allowed maximum',
      );
      expect(100_000_000 * 99).toBeGreaterThan(MAX_ORDER_TOTAL);
      expect(repo.createOrder).not.toHaveBeenCalled();
    });

    it('still returns the order when enqueueing fails (recovery will retry)', async () => {
      queue.enqueueProcessing.mockResolvedValue(false);
      await expect(service.checkout(customer, { shippingAddress: 'Kyiv' })).resolves.toMatchObject({
        replayed: false,
      });
    });
  });

  describe('checkout: idempotency', () => {
    it('replays an order committed by a parallel request while waiting for the cart lock', async () => {
      repo.findByIdempotencyKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeOrder({ id: 'first', shippingAddress: 'Kyiv' }));

      const result = await service.checkout(customer, { shippingAddress: 'Kyiv' }, 'key-12345');

      expect(result).toMatchObject({ replayed: true, order: { id: 'first' } });
      expect(repo.findCartLines).not.toHaveBeenCalled();
      expect(repo.createOrder).not.toHaveBeenCalled();
      expect(queue.enqueueProcessing).not.toHaveBeenCalled();
    });

    it('rejects a reused key with a different payload', async () => {
      repo.findByIdempotencyKey.mockResolvedValue(makeOrder({ shippingAddress: 'Kyiv' }));

      await expect(
        service.checkout(customer, { shippingAddress: 'Lviv' }, 'key-12345'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('returns the existing order for a repeated key without reserving stock', async () => {
      repo.findByIdempotencyKey.mockResolvedValue(makeOrder({ idempotencyKey: 'key-12345' }));

      const result = await service.checkout(customer, { shippingAddress: 'Kyiv' }, 'key-12345');

      expect(result.replayed).toBe(true);
      expect(repo.transaction).not.toHaveBeenCalled();
      expect(queue.enqueueProcessing).not.toHaveBeenCalled();
    });

    it('resolves a concurrent duplicate (unique violation) to the winning order', async () => {
      repo.findByIdempotencyKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeOrder({ id: 'winner' }));
      repo.createOrder.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.checkout(customer, { shippingAddress: 'Kyiv' }, 'key-12345');

      expect(result).toMatchObject({ replayed: true, order: { id: 'winner' } });
    });
  });

  describe('status transitions', () => {
    it('lets a customer cancel a NEW order and releases the reserved stock', async () => {
      const order = makeOrder();
      repo.findById.mockResolvedValue(order);

      await service.cancelByCustomer(customer, order.id, 'Changed my mind');

      expect(repo.updateStatusIfCurrent).toHaveBeenCalledWith(
        TX,
        order.id,
        OrderStatus.NEW,
        OrderStatus.CANCELLED,
        { cancelReason: 'Changed my mind', paymentId: undefined },
      );
      expect(repo.releaseStock).toHaveBeenCalledWith(TX, order.items);
      expect(repo.addStatusHistory).toHaveBeenCalledWith(TX, {
        orderId: order.id,
        fromStatus: OrderStatus.NEW,
        toStatus: OrderStatus.CANCELLED,
        changedById: customer.id,
        note: 'Changed my mind',
      });
      expect(cache.invalidate).toHaveBeenCalled();
    });

    it('hides orders of other users behind 404', async () => {
      repo.findById.mockResolvedValue(makeOrder({ userId: 'someone-else' }));
      await expect(service.cancelByCustomer(customer, 'order-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findMineById(customer.id, 'order-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.updateStatusIfCurrent).not.toHaveBeenCalled();
    });

    it('does not let a customer cancel an order that is already being processed', async () => {
      repo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.PROCESSING }));
      await expect(service.cancelByCustomer(customer, 'order-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects transitions that the state machine does not allow', async () => {
      repo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.NEW }));
      await expect(
        service.changeStatusByAdmin(admin, 'order-1', OrderStatus.COMPLETED),
      ).rejects.toThrow('Cannot change order status from NEW to COMPLETED');
      expect(repo.updateStatusIfCurrent).not.toHaveBeenCalled();
    });

    it('does not release stock for non-cancel transitions', async () => {
      repo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.PROCESSING }));
      await service.changeStatusByAdmin(admin, 'order-1', OrderStatus.SHIPPED);
      expect(repo.releaseStock).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('fails with 409 when the status changed concurrently, without double-releasing stock', async () => {
      repo.updateStatusIfCurrent.mockResolvedValue(false);
      await expect(
        service.changeStatusByAdmin(admin, 'order-1', OrderStatus.CANCELLED),
      ).rejects.toThrow('changed concurrently');
      expect(repo.releaseStock).not.toHaveBeenCalled();
      expect(repo.addStatusHistory).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing order', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.changeStatusByAdmin(admin, 'missing', OrderStatus.SHIPPED),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('processPayment (queue worker)', () => {
    it('moves a NEW order to PROCESSING after a successful mock payment', async () => {
      await service.processPayment('order-1');

      expect(payments.charge).toHaveBeenCalledWith('order-1', 25_000);
      expect(repo.updateStatusIfCurrent).toHaveBeenCalledWith(
        TX,
        'order-1',
        OrderStatus.NEW,
        OrderStatus.PROCESSING,
        { cancelReason: null, paymentId: 'tx-1' },
      );
      expect(repo.addStatusHistory).toHaveBeenCalledWith(
        TX,
        expect.objectContaining({ changedById: null, toStatus: OrderStatus.PROCESSING }),
      );
    });

    it('cancels the order and releases stock when the payment is declined', async () => {
      payments.charge.mockResolvedValue({ success: false, reason: 'Payment declined (mock)' });

      await service.processPayment('order-1');

      expect(repo.updateStatusIfCurrent).toHaveBeenCalledWith(
        TX,
        'order-1',
        OrderStatus.NEW,
        OrderStatus.CANCELLED,
        { cancelReason: 'Payment declined (mock)', paymentId: undefined },
      );
      expect(repo.releaseStock).toHaveBeenCalled();
    });

    it('is idempotent: skips orders that are no longer NEW', async () => {
      repo.findById.mockResolvedValue(makeOrder({ status: OrderStatus.PROCESSING }));
      await service.processPayment('order-1');
      expect(payments.charge).not.toHaveBeenCalled();
    });

    it('schedules a refund when the order was cancelled while the payment was in flight', async () => {
      repo.findById
        .mockResolvedValueOnce(makeOrder())
        .mockResolvedValueOnce(makeOrder({ status: OrderStatus.CANCELLED }));

      await service.processPayment('order-1');

      expect(repo.attachPayment).toHaveBeenCalledWith('order-1', 'tx-1');
      expect(queue.enqueueRefund).toHaveBeenCalledWith('order-1');
      expect(payments.refund).not.toHaveBeenCalled();
      expect(repo.updateStatusIfCurrent).not.toHaveBeenCalled();
    });

    it('ignores unknown orders', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.processPayment('missing')).resolves.toBeUndefined();
      expect(payments.charge).not.toHaveBeenCalled();
    });
  });

  describe('refunds', () => {
    const paidOrder = (overrides: Partial<OrderWithDetails> = {}) =>
      makeOrder({ status: OrderStatus.PROCESSING, paymentId: 'tx-1', ...overrides });

    it('does not let an admin mark an order as processing without a payment', async () => {
      await expect(
        service.changeStatusByAdmin(admin, 'order-1', OrderStatus.PROCESSING),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.updateStatusIfCurrent).not.toHaveBeenCalled();
    });

    it('schedules a refund when an admin cancels a paid order', async () => {
      repo.findById.mockResolvedValue(paidOrder());

      await service.changeStatusByAdmin(admin, 'order-1', OrderStatus.CANCELLED);

      expect(repo.releaseStock).toHaveBeenCalled();
      expect(queue.enqueueRefund).toHaveBeenCalledWith('order-1');
    });

    it('does not schedule a refund for an unpaid order', async () => {
      await service.changeStatusByAdmin(admin, 'order-1', OrderStatus.CANCELLED);
      expect(queue.enqueueRefund).not.toHaveBeenCalled();
    });

    it('does not schedule a refund for other transitions of a paid order', async () => {
      repo.findById.mockResolvedValue(paidOrder());
      await service.changeStatusByAdmin(admin, 'order-1', OrderStatus.SHIPPED);
      expect(queue.enqueueRefund).not.toHaveBeenCalled();
    });

    it('refunds a cancelled paid order once and marks it refunded', async () => {
      repo.findById.mockResolvedValue(paidOrder({ status: OrderStatus.CANCELLED }));

      await service.refundPayment('order-1');

      expect(payments.refund).toHaveBeenCalledWith('order-1', 'tx-1');
      expect(repo.markRefunded).toHaveBeenCalledWith('order-1');
    });

    it.each([
      ['unknown order', null],
      ['never paid', makeOrder({ status: OrderStatus.CANCELLED })],
      ['already refunded', paidOrder({ status: OrderStatus.CANCELLED, refundedAt: new Date() })],
      ['not cancelled', paidOrder()],
    ])('skips the refund for an order that is %s', async (_case, order) => {
      repo.findById.mockResolvedValue(order);

      await service.refundPayment('order-1');

      expect(payments.refund).not.toHaveBeenCalled();
      expect(repo.markRefunded).not.toHaveBeenCalled();
    });

    it('lets the queue retry when the payment provider fails', async () => {
      repo.findById.mockResolvedValue(paidOrder({ status: OrderStatus.CANCELLED }));
      payments.refund.mockRejectedValue(new Error('gateway timeout'));

      await expect(service.refundPayment('order-1')).rejects.toThrow('gateway timeout');
      expect(repo.markRefunded).not.toHaveBeenCalled();
    });
  });

  describe('admin listing', () => {
    it('rejects dates that do not exist', async () => {
      await expect(service.findAll({ page: 1, limit: 10, from: '2026-02-30' })).rejects.toThrow(
        'from is not a valid calendar date',
      );
    });

    it('supports open-ended ranges', async () => {
      await service.findAll({ page: 1, limit: 10, from: '2026-10-25' });
      expect(repo.search.mock.calls[0][0].where.createdAt).toEqual({
        gte: new Date('2026-10-24T21:00:00Z'),
        lt: undefined,
      });
    });

    it('rejects an inverted date range', async () => {
      await expect(
        service.findAll({ page: 1, limit: 10, from: '2026-10-10', to: '2026-10-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('filters by status, customer and local-day range in the store time zone', async () => {
      await service.findAll({
        page: 2,
        limit: 5,
        status: OrderStatus.SHIPPED,
        userId: 'user-9',
        from: '2026-10-01',
        to: '2026-10-08',
      });
      expect(repo.search).toHaveBeenCalledWith({
        where: {
          userId: 'user-9',
          status: OrderStatus.SHIPPED,
          createdAt: {
            gte: new Date('2026-09-30T21:00:00Z'),
            lt: new Date('2026-10-07T21:00:00Z'),
          },
        },
        skip: 5,
        take: 5,
      });
    });
  });
});

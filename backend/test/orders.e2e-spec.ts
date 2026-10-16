import request from 'supertest';
import { Role } from '../src/generated/prisma/client.js';
import { MockPaymentService } from '../src/orders/payment/mock-payment.service.js';
import { createTestApp, createUserAndLogin, type TestContext, waitFor } from './utils/test-app.js';

type Client = ReturnType<typeof clientFor>;

const clientFor = (ctx: TestContext, token: string) => {
  const api = () => request(ctx.app.getHttpServer());
  return {
    get: (path: string) => api().get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string) => api().post(path).set('Authorization', `Bearer ${token}`),
    patch: (path: string) => api().patch(path).set('Authorization', `Bearer ${token}`),
    delete: (path: string) => api().delete(path).set('Authorization', `Bearer ${token}`),
  };
};

const ADDRESS = { shippingAddress: 'Kyiv, Khreshchatyk 1' };

async function setupCatalog(ctx: TestContext, label: string) {
  const suffix = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const category = await ctx.prisma.category.create({
    data: { name: `E2E Orders ${suffix}`, slug: `e2e-orders-${suffix}` },
  });
  const createProduct = (name: string, price: number, stock: number) =>
    ctx.prisma.product.create({ data: { name, price, stock, categoryId: category.id } });
  return { categoryId: category.id, createProduct };
}

async function cleanup(ctx: TestContext, userIds: string[], categoryId: string) {
  await ctx.prisma.order.deleteMany({ where: { userId: { in: userIds } } });
  await ctx.prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
  await ctx.prisma.product.deleteMany({ where: { categoryId } });
  await ctx.prisma.category.delete({ where: { id: categoryId } });
  await ctx.prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('Orders (e2e)', () => {
  let ctx: TestContext;
  let catalog: Awaited<ReturnType<typeof setupCatalog>>;
  let admin: Client;
  const userIds: string[] = [];

  const newCustomer = async () => {
    const user = await createUserAndLogin(ctx, Role.CUSTOMER);
    userIds.push(user.id);
    return clientFor(ctx, user.accessToken);
  };
  const stockOf = async (productId: string) =>
    (await ctx.prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;
  const waitForStatus = (client: Client, orderId: string, status: string) =>
    waitFor(
      async () => (await client.get(`/api/orders/${orderId}`)).body,
      (order) => order.status === status,
    );

  beforeAll(async () => {
    ctx = await createTestApp();
    catalog = await setupCatalog(ctx, 'main');
    const adminUser = await createUserAndLogin(ctx, Role.ADMIN);
    userIds.push(adminUser.id);
    admin = clientFor(ctx, adminUser.accessToken);
  });

  afterAll(async () => {
    await cleanup(ctx, userIds, catalog.categoryId);
    await ctx.app.close();
  });

  it('critical flow: add to cart -> checkout -> stock decreases -> queue -> fulfilment', async () => {
    const customer = await newCustomer();
    const product = await catalog.createProduct('Flow Phone', 12_000, 10);

    await customer.get(`/api/products/${product.id}`).expect(200);
    await customer.post('/api/cart/items').send({ productId: product.id, quantity: 3 }).expect(200);

    const placed = await customer.post('/api/orders').send(ADDRESS).expect(201);
    expect(placed.body).toMatchObject({
      status: 'NEW',
      totalAmount: 36_000,
      shippingAddress: ADDRESS.shippingAddress,
      items: [
        {
          productId: product.id,
          productName: 'Flow Phone',
          unitPrice: 12_000,
          quantity: 3,
          lineTotal: 36_000,
        },
      ],
    });

    expect(await stockOf(product.id)).toBe(7);
    const catalogView = await customer.get(`/api/products/${product.id}`).expect(200);
    expect(catalogView.body.stock).toBe(7);
    expect(catalogView.headers['x-cache']).toBe('MISS');
    expect((await customer.get('/api/cart').expect(200)).body.items).toEqual([]);

    const processed = await waitForStatus(customer, placed.body.id, 'PROCESSING');
    expect(processed.status).toBe('PROCESSING');
    expect(processed.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'NEW',
      'PROCESSING',
    ]);
    expect(processed.statusHistory[1]).toMatchObject({ byUser: false });

    await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'SHIPPED' })
      .expect(200);
    const completed = await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'COMPLETED', note: 'Delivered' })
      .expect(200);
    expect(completed.body.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'NEW',
      'PROCESSING',
      'SHIPPED',
      'COMPLETED',
    ]);

    const history = await customer.get('/api/orders').expect(200);
    expect(history.body.items[0]).toMatchObject({
      id: placed.body.id,
      status: 'COMPLETED',
      itemsCount: 1,
    });
    expect(await stockOf(product.id)).toBe(7);
  });

  it('never oversells: concurrent checkouts for the last units', async () => {
    const product = await catalog.createProduct('Hot Item', 1_000, 5);
    const customers: Client[] = [];
    for (let i = 0; i < 12; i++) customers.push(await newCustomer());
    for (const customer of customers) {
      await customer
        .post('/api/cart/items')
        .send({ productId: product.id, quantity: 1 })
        .expect(200);
    }

    const results = await Promise.all(
      customers.map((customer) => customer.post('/api/orders').send(ADDRESS)),
    );

    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses.filter((s) => s === 201)).toHaveLength(5);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(await stockOf(product.id)).toBe(0);

    const sold = await ctx.prisma.orderItem.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true },
    });
    expect(sold._sum.quantity).toBe(5);

    const rejected = results.find((r) => r.status === 409)!;
    expect(rejected.body.items).toEqual([
      { productId: product.id, name: 'Hot Item', requested: 1, available: 0 },
    ]);
  });

  it('never oversells: competing multi-unit orders', async () => {
    const product = await catalog.createProduct('Bundle', 2_000, 5);
    const [first, second] = [await newCustomer(), await newCustomer()];
    await first.post('/api/cart/items').send({ productId: product.id, quantity: 3 }).expect(200);
    await second.post('/api/cart/items').send({ productId: product.id, quantity: 3 }).expect(200);

    const results = await Promise.all(
      [first, second].map((c) => c.post('/api/orders').send(ADDRESS)),
    );

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await stockOf(product.id)).toBe(2);
  });

  it('is all-or-nothing across order lines', async () => {
    const customer = await newCustomer();
    const plenty = await catalog.createProduct('Plenty', 100, 50);
    const scarce = await catalog.createProduct('Scarce', 100, 2);
    await customer.post('/api/cart/items').send({ productId: plenty.id, quantity: 5 }).expect(200);
    await customer.post('/api/cart/items').send({ productId: scarce.id, quantity: 2 }).expect(200);
    await ctx.prisma.product.update({ where: { id: scarce.id }, data: { stock: 1 } });

    const rejected = await customer.post('/api/orders').send(ADDRESS).expect(409);

    expect(rejected.body.items).toEqual([
      { productId: scarce.id, name: 'Scarce', requested: 2, available: 1 },
    ]);
    expect(await stockOf(plenty.id)).toBe(50);
    expect(await stockOf(scarce.id)).toBe(1);
    expect((await customer.get('/api/cart').expect(200)).body.items).toHaveLength(2);
    expect((await customer.get('/api/orders').expect(200)).body.meta.total).toBe(0);
  });

  it('honours Idempotency-Key, including concurrent duplicates', async () => {
    const customer = await newCustomer();
    const product = await catalog.createProduct('Idempotent', 500, 10);
    await customer.post('/api/cart/items').send({ productId: product.id, quantity: 2 }).expect(200);

    const key = `checkout-${Date.now()}`;
    const [a, b] = await Promise.all([
      customer.post('/api/orders').set('Idempotency-Key', key).send(ADDRESS),
      customer.post('/api/orders').set('Idempotency-Key', key).send(ADDRESS),
    ]);

    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
    expect(await stockOf(product.id)).toBe(8);

    const replay = await customer
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send(ADDRESS)
      .expect(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.id).toBe(a.body.id);

    await customer.post('/api/orders').set('Idempotency-Key', 'bad key!').send(ADDRESS).expect(400);
  });

  it('enforces the status workflow for admins and customers', async () => {
    const customer = await newCustomer();
    const product = await catalog.createProduct('Workflow', 900, 5);
    await customer.post('/api/cart/items').send({ productId: product.id, quantity: 2 }).expect(200);
    const placed = await customer.post('/api/orders').send(ADDRESS).expect(201);
    await waitForStatus(customer, placed.body.id, 'PROCESSING');

    await customer.post(`/api/orders/${placed.body.id}/cancel`).send({}).expect(409);
    await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'COMPLETED' })
      .expect(409);
    await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'NEW' })
      .expect(409);
    await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'LOST' })
      .expect(400);

    const cancelled = await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'CANCELLED', note: 'Out of delivery zone' })
      .expect(200);
    expect(cancelled.body.cancelReason).toBe('Out of delivery zone');
    expect(await stockOf(product.id)).toBe(5);

    await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'SHIPPED' })
      .expect(409);
  });

  it('protects orders from other users and handles missing ones', async () => {
    const owner = await newCustomer();
    const stranger = await newCustomer();
    const product = await catalog.createProduct('Private', 300, 5);
    await owner.post('/api/cart/items').send({ productId: product.id }).expect(200);
    const placed = await owner.post('/api/orders').send(ADDRESS).expect(201);

    await stranger.get(`/api/orders/${placed.body.id}`).expect(404);
    await stranger.post(`/api/orders/${placed.body.id}/cancel`).send({}).expect(404);
    expect((await stranger.get('/api/orders').expect(200)).body.meta.total).toBe(0);
    await stranger.get('/api/admin/orders').expect(403);
    await stranger
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'CANCELLED' })
      .expect(403);

    await owner.get('/api/orders/00000000-0000-4000-8000-000000000000').expect(404);
    await owner.get('/api/orders/not-a-uuid').expect(400);
    await admin.get('/api/admin/orders/00000000-0000-4000-8000-000000000000').expect(404);
    await request(ctx.app.getHttpServer()).get('/api/orders').expect(401);

    const adminView = await admin.get(`/api/admin/orders/${placed.body.id}`).expect(200);
    expect(adminView.body.customer.id).toBeDefined();
  });

  it('validates checkout input', async () => {
    const customer = await newCustomer();
    await customer.post('/api/orders').send(ADDRESS).expect(400);
    await customer.post('/api/orders').send({ shippingAddress: 'abc' }).expect(400);
    await customer
      .post('/api/orders')
      .send({ ...ADDRESS, totalAmount: 1 })
      .expect(400);
    await customer
      .post('/api/orders')
      .send({ shippingAddress: 'Kyiv\n[Nest] LOG fake entry' })
      .expect(400);
  });

  it('rejects control characters that could forge log entries', async () => {
    const customer = await newCustomer();
    const product = await catalog.createProduct('Log safe', 100, 5);
    await customer.post('/api/cart/items').send({ productId: product.id }).expect(200);
    const placed = await customer.post('/api/orders').send(ADDRESS).expect(201);

    const forged = 'ok\n[Nest] 1 - LOG [AuthService] User logged in: attacker';
    await customer
      .post(`/api/orders/${placed.body.id}/cancel`)
      .send({ reason: forged })
      .expect(400);
    await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'CANCELLED', note: forged })
      .expect(400);
    await admin
      .patch(`/api/admin/orders/${placed.body.id}/status`)
      .send({ status: 'CANCELLED', note: 'Reason: «out of stock» — 100%' })
      .expect(200);
  });

  it('lets admins filter all orders', async () => {
    const customer = await newCustomer();
    const product = await catalog.createProduct('Filter', 100, 5);
    await customer.post('/api/cart/items').send({ productId: product.id }).expect(200);
    const placed = await customer.post('/api/orders').send(ADDRESS).expect(201);
    const customerId = placed.body.customer.id;

    const byUser = await admin.get('/api/admin/orders').query({ userId: customerId }).expect(200);
    expect(byUser.body.items.map((o: { id: string }) => o.id)).toEqual([placed.body.id]);

    const cancelledOnly = await admin
      .get('/api/admin/orders')
      .query({ userId: customerId, status: 'CANCELLED' })
      .expect(200);
    expect(cancelledOnly.body.meta.total).toBe(0);

    await admin
      .get('/api/admin/orders')
      .query({ from: '2026-10-10', to: '2026-10-01' })
      .expect(400);
    await admin.get('/api/admin/orders').query({ from: '2026-10-01T00:00:00Z' }).expect(400);
    await admin.get('/api/admin/orders').query({ to: '2026-02-30' }).expect(400);

    const kyivDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(
      new Date(placed.body.createdAt),
    );
    const nextDay = new Date(Date.parse(`${kyivDay}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const sameDay = await admin
      .get('/api/admin/orders')
      .query({ userId: customerId, from: kyivDay, to: nextDay })
      .expect(200);
    expect(sameDay.body.meta.total).toBe(1);
    const before = await admin
      .get('/api/admin/orders')
      .query({ userId: customerId, to: kyivDay })
      .expect(200);
    expect(before.body.meta.total).toBe(0);
  });
});

describe('Orders with failing payments (e2e)', () => {
  let ctx: TestContext;
  let catalog: Awaited<ReturnType<typeof setupCatalog>>;
  const userIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder.overrideProvider(MockPaymentService).useValue({
        charge: async () => ({ success: false, reason: 'Payment declined (mock)' }),
        refund: async () => undefined,
      }),
    );
    catalog = await setupCatalog(ctx, 'declined');
  });

  afterAll(async () => {
    await cleanup(ctx, userIds, catalog.categoryId);
    await ctx.app.close();
  });

  it('cancels the order and releases stock when the payment is declined', async () => {
    const user = await createUserAndLogin(ctx, Role.CUSTOMER);
    userIds.push(user.id);
    const customer = clientFor(ctx, user.accessToken);
    const product = await catalog.createProduct('Declined', 1_000, 3);
    await customer.post('/api/cart/items').send({ productId: product.id, quantity: 2 }).expect(200);

    const placed = await customer.post('/api/orders').send(ADDRESS).expect(201);
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      1,
    );

    const order = await waitFor(
      async () => (await customer.get(`/api/orders/${placed.body.id}`)).body,
      (body) => body.status === 'CANCELLED',
    );
    expect(order).toMatchObject({ status: 'CANCELLED', cancelReason: 'Payment declined (mock)' });
    expect((await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(
      3,
    );
  });
});

describe('Cancellation while the payment is in flight (e2e)', () => {
  let ctx: TestContext;
  let catalog: Awaited<ReturnType<typeof setupCatalog>>;
  const userIds: string[] = [];
  const refunds: string[] = [];
  let releasePayment: () => void = () => undefined;
  let paymentGate: Promise<void> = Promise.resolve();

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder.overrideProvider(MockPaymentService).useValue({
        charge: async (orderId: string) => {
          await paymentGate;
          return { success: true, transactionId: `mock_${orderId}` };
        },
        refund: async (orderId: string) => {
          refunds.push(orderId);
        },
      }),
    );
    catalog = await setupCatalog(ctx, 'inflight');
  });

  afterAll(async () => {
    releasePayment();
    await cleanup(ctx, userIds, catalog.categoryId);
    await ctx.app.close();
  });

  it('lets a customer cancel a NEW order and refunds a payment captured meanwhile', async () => {
    paymentGate = new Promise((resolve) => (releasePayment = resolve));
    const user = await createUserAndLogin(ctx, Role.CUSTOMER);
    userIds.push(user.id);
    const customer = clientFor(ctx, user.accessToken);
    const product = await catalog.createProduct('Cancelable', 700, 4);
    const stockOf = async () =>
      (await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock;
    await customer.post('/api/cart/items').send({ productId: product.id, quantity: 3 }).expect(200);

    const placed = await customer.post('/api/orders').send(ADDRESS).expect(201);
    expect(await stockOf()).toBe(1);

    const cancelled = await customer
      .post(`/api/orders/${placed.body.id}/cancel`)
      .send({ reason: 'Changed my mind' })
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Changed my mind' });
    expect(cancelled.body.payment).toEqual({
      status: 'NOT_PAID',
      transactionId: null,
      refundedAt: null,
    });
    expect(await stockOf()).toBe(4);
    await customer.post(`/api/orders/${placed.body.id}/cancel`).send({}).expect(409);

    releasePayment();
    const refunded = await waitFor(
      async () => (await customer.get(`/api/orders/${placed.body.id}`)).body,
      (order) => order.payment.status === 'REFUNDED',
    );
    expect(refunded.status).toBe('CANCELLED');
    expect(refunded.payment.transactionId).toBe(`mock_${placed.body.id}`);
    expect(refunds).toEqual([placed.body.id]);
    expect(await stockOf()).toBe(4);
  });
});

import request from 'supertest';
import { OrderStatus, Role } from '../src/generated/prisma/client.js';
import { createTestApp, createUserAndLogin, type TestContext } from './utils/test-app.js';

const PERIOD = { from: '2021-03-08', to: '2021-03-15' };

describe('Analytics (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;
  const userIds: string[] = [];
  const products: Record<'phone' | 'case' | 'cable', string> = { phone: '', case: '', cable: '' };
  const names: Record<keyof typeof products, string> = {
    phone: 'Analytics Phone',
    case: 'Analytics Case',
    cable: '=HYPERLINK("http://evil")',
  };

  const get = (path: string, query: Record<string, string | number> = {}, token = adminToken) =>
    request(ctx.app.getHttpServer()).get(path).query(query).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ctx = await createTestApp();
    const admin = await createUserAndLogin(ctx, Role.ADMIN);
    const customer = await createUserAndLogin(ctx, Role.CUSTOMER);
    adminToken = admin.accessToken;
    customerToken = customer.accessToken;
    userIds.push(admin.id, customer.id);

    const suffix = Date.now();
    categoryId = (
      await ctx.prisma.category.create({
        data: { name: `E2E Analytics ${suffix}`, slug: `e2e-analytics-${suffix}` },
      })
    ).id;
    const create = (name: string, price: number) =>
      ctx.prisma.product
        .create({ data: { name, price, stock: 100, categoryId } })
        .then((p) => p.id);
    products.phone = await create(names.phone, 10_000);
    products.case = await create(names.case, 1_000);
    products.cable = await create(names.cable, 500);

    const order = (
      createdAt: string,
      status: OrderStatus,
      items: [keyof typeof products, number, number][],
    ) =>
      ctx.prisma.order.create({
        data: {
          userId: customer.id,
          status,
          shippingAddress: 'Kyiv',
          createdAt: new Date(createdAt),
          totalAmount: items.reduce((sum, [, price, qty]) => sum + price * qty, 0),
          items: {
            create: items.map(([key, unitPrice, quantity]) => ({
              productId: products[key],
              productName: names[key],
              unitPrice,
              quantity,
            })),
          },
        },
      });

    await order('2021-03-09T10:00:00Z', OrderStatus.COMPLETED, [
      ['phone', 10_000, 1],
      ['case', 1_000, 3],
    ]);
    await order('2021-03-10T22:30:00Z', OrderStatus.SHIPPED, [['case', 1_000, 2]]);
    await order('2021-03-11T08:00:00Z', OrderStatus.PROCESSING, [['cable', 500, 4]]);
    await order('2021-03-11T09:00:00Z', OrderStatus.CANCELLED, [['phone', 10_000, 5]]);
    await order('2021-03-12T09:00:00Z', OrderStatus.NEW, [['phone', 10_000, 1]]);
    await order('2021-03-07T21:59:00Z', OrderStatus.COMPLETED, [['phone', 10_000, 9]]);
    await order('2021-03-14T22:00:00Z', OrderStatus.COMPLETED, [['phone', 10_000, 9]]);
  });

  afterAll(async () => {
    await ctx.prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await ctx.prisma.product.deleteMany({ where: { categoryId } });
    await ctx.prisma.category.delete({ where: { id: categoryId } });
    await ctx.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await ctx.app.close();
  });

  it('summarises paid orders only, within the period in the store time zone', async () => {
    const res = await get('/api/admin/analytics/summary', PERIOD).expect(200);

    expect(res.body).toEqual({
      period: { ...PERIOD, timeZone: 'Europe/Kyiv' },
      revenue: 17_000,
      ordersCount: 3,
      averageOrderValue: 5_667,
      itemsSold: 10,
      cancelledCount: 1,
      topProducts: [
        { productId: products.case, name: 'Analytics Case', quantity: 5, revenue: 5_000 },
        {
          productId: products.cable,
          name: '=HYPERLINK("http://evil")',
          quantity: 4,
          revenue: 2_000,
        },
        { productId: products.phone, name: 'Analytics Phone', quantity: 1, revenue: 10_000 },
      ],
    });
  });

  it('limits the top products list', async () => {
    const res = await get('/api/admin/analytics/summary', { ...PERIOD, top: 1 }).expect(200);
    expect(res.body.topProducts.map((p: { productId: string }) => p.productId)).toEqual([
      products.case,
    ]);
  });

  it('returns zero-filled daily sales grouped by local day', async () => {
    const res = await get('/api/admin/analytics/sales-by-day', PERIOD).expect(200);

    expect(res.body.days).toEqual([
      { date: '2021-03-08', revenue: 0, ordersCount: 0 },
      { date: '2021-03-09', revenue: 13_000, ordersCount: 1 },
      { date: '2021-03-10', revenue: 0, ordersCount: 0 },
      { date: '2021-03-11', revenue: 4_000, ordersCount: 2 },
      { date: '2021-03-12', revenue: 0, ordersCount: 0 },
      { date: '2021-03-13', revenue: 0, ordersCount: 0 },
      { date: '2021-03-14', revenue: 0, ordersCount: 0 },
    ]);
  });

  it('exports the sales report as CSV with formula injection neutralised', async () => {
    const res = await get('/api/admin/analytics/sales-report.csv', PERIOD).expect(200);

    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="sales-report_2021-03-08_2021-03-15.csv"',
    );
    const lines = res.text.trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      '﻿order_id,ordered_at,status,customer_email,product_id,product_name,quantity,unit_price_uah,line_total_uah',
    );
    expect(lines).toHaveLength(1 + 4);
    expect(lines.map((line) => line.split(',')[1])).toContain('2021-03-11 00:30');
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(res.text).not.toContain('CANCELLED');
    expect(res.text).not.toContain(',NEW,');
  });

  it('validates the period', async () => {
    await get('/api/admin/analytics/summary', { from: '2021-03-15', to: '2021-03-08' }).expect(400);
    await get('/api/admin/analytics/summary', { from: '2019-01-01', to: '2021-01-01' }).expect(400);
    await get('/api/admin/analytics/sales-by-day', { from: '2021-02-30' }).expect(400);
    await get('/api/admin/analytics/sales-report.csv', { to: 'tomorrow' }).expect(400);
    await get('/api/admin/analytics/summary', { top: 0 }).expect(400);
  });

  it('is available to admins only', async () => {
    await get('/api/admin/analytics/summary', {}, customerToken).expect(403);
    await get('/api/admin/analytics/sales-report.csv', {}, customerToken).expect(403);
    await request(ctx.app.getHttpServer()).get('/api/admin/analytics/sales-by-day').expect(401);
  });

  it('defaults to the last 30 days', async () => {
    const res = await get('/api/admin/analytics/sales-by-day').expect(200);
    expect(res.body.days).toHaveLength(30);
    expect(res.body.days.at(-1).date).toBe(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date()),
    );
  });
});

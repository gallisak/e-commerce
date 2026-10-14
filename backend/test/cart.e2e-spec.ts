import request from 'supertest';
import { Role } from '../src/generated/prisma/client.js';
import { createTestApp, createUserAndLogin, type TestContext } from './utils/test-app.js';

describe('Cart (e2e)', () => {
  let ctx: TestContext;
  let categoryId: string;
  const userIds: string[] = [];
  const products: Record<'phone' | 'case' | 'cable', string> = { phone: '', case: '', cable: '' };

  const api = () => request(ctx.app.getHttpServer());
  const as = (token: string) => ({
    get: (path: string) => api().get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string) => api().post(path).set('Authorization', `Bearer ${token}`),
    patch: (path: string) => api().patch(path).set('Authorization', `Bearer ${token}`),
    delete: (path: string) => api().delete(path).set('Authorization', `Bearer ${token}`),
  });
  const newCustomer = async () => {
    const user = await createUserAndLogin(ctx, Role.CUSTOMER);
    userIds.push(user.id);
    return as(user.accessToken);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    const category = await ctx.prisma.category.create({
      data: { name: `E2E Cart ${Date.now()}`, slug: `e2e-cart-${Date.now()}` },
    });
    categoryId = category.id;
    const create = (name: string, price: number, stock: number) =>
      ctx.prisma.product.create({ data: { name, price, stock, categoryId } }).then((p) => p.id);
    products.phone = await create('Cart Phone', 10_000, 3);
    products.case = await create('Cart Case', 500, 100);
    products.cable = await create('Cart Cable', 300, 0);
  });

  afterAll(async () => {
    await ctx.prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
    await ctx.prisma.product.deleteMany({ where: { categoryId } });
    await ctx.prisma.category.delete({ where: { id: categoryId } });
    await ctx.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await ctx.app.close();
  });

  it('requires authentication', async () => {
    await api().get('/api/cart').expect(401);
    await api().post('/api/cart/items').send({ productId: products.case }).expect(401);
  });

  it('starts empty, adds, increments, updates, removes and clears', async () => {
    const user = await newCustomer();

    await user
      .get('/api/cart')
      .expect(200, { items: [], totalQuantity: 0, totalAmount: 0, hasIssues: false });

    await user.post('/api/cart/items').send({ productId: products.phone }).expect(200);
    const incremented = await user
      .post('/api/cart/items')
      .send({ productId: products.phone, quantity: 2 })
      .expect(200);
    expect(incremented.body.items).toEqual([
      expect.objectContaining({
        productId: products.phone,
        quantity: 3,
        lineTotal: 30_000,
        issue: null,
      }),
    ]);

    const withCase = await user
      .post('/api/cart/items')
      .send({ productId: products.case, quantity: 4 })
      .expect(200);
    expect(withCase.body).toMatchObject({
      totalQuantity: 7,
      totalAmount: 32_000,
      hasIssues: false,
    });
    expect(withCase.body.items.map((i: { productId: string }) => i.productId)).toEqual([
      products.phone,
      products.case,
    ]);

    const updated = await user
      .patch(`/api/cart/items/${products.phone}`)
      .send({ quantity: 1 })
      .expect(200);
    expect(updated.body.totalAmount).toBe(12_000);

    const removed = await user.delete(`/api/cart/items/${products.phone}`).expect(200);
    expect(removed.body.items).toHaveLength(1);
    await user.delete(`/api/cart/items/${products.phone}`).expect(200);

    const cleared = await user.delete('/api/cart').expect(200);
    expect(cleared.body.items).toEqual([]);
  });

  it('enforces stock limits and reports the available quantity', async () => {
    const user = await newCustomer();

    const tooMany = await user
      .post('/api/cart/items')
      .send({ productId: products.phone, quantity: 4 })
      .expect(409);
    expect(tooMany.body).toMatchObject({ productId: products.phone, available: 3 });

    await user.post('/api/cart/items').send({ productId: products.phone, quantity: 3 }).expect(200);
    await user.post('/api/cart/items').send({ productId: products.phone }).expect(409);
    await user.patch(`/api/cart/items/${products.phone}`).send({ quantity: 4 }).expect(409);

    const cart = await user.get('/api/cart').expect(200);
    expect(cart.body.items[0].quantity).toBe(3);

    const outOfStock = await user
      .post('/api/cart/items')
      .send({ productId: products.cable })
      .expect(409);
    expect(outOfStock.body.available).toBe(0);
  });

  it('validates input and handles missing products', async () => {
    const user = await newCustomer();

    await user.post('/api/cart/items').send({ productId: 'nope' }).expect(400);
    await user.post('/api/cart/items').send({ productId: products.case, quantity: 0 }).expect(400);
    await user
      .post('/api/cart/items')
      .send({ productId: products.case, quantity: 1.5 })
      .expect(400);
    await user
      .post('/api/cart/items')
      .send({ productId: products.case, quantity: 100 })
      .expect(400);
    await user.patch(`/api/cart/items/${products.case}`).send({}).expect(400);
    await user.patch('/api/cart/items/not-a-uuid').send({ quantity: 1 }).expect(400);
    await user
      .post('/api/cart/items')
      .send({ productId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
    await user.patch(`/api/cart/items/${products.case}`).send({ quantity: 1 }).expect(404);
    await user.patch(`/api/cart/items/${products.cable}`).send({ quantity: 1 }).expect(404);
  });

  it('keeps carts isolated between users', async () => {
    const alice = await newCustomer();
    const bob = await newCustomer();

    await alice.post('/api/cart/items').send({ productId: products.case, quantity: 2 }).expect(200);

    await bob
      .get('/api/cart')
      .expect(200)
      .expect((res) => expect(res.body.items).toEqual([]));
    await bob.patch(`/api/cart/items/${products.case}`).send({ quantity: 5 }).expect(404);
    await bob.delete(`/api/cart/items/${products.case}`).expect(200);
    await bob.delete('/api/cart').expect(200);

    const aliceCart = await alice.get('/api/cart').expect(200);
    expect(aliceCart.body.items[0].quantity).toBe(2);
  });

  it('flags items whose stock dropped after they were added', async () => {
    const user = await newCustomer();
    const product = await ctx.prisma.product.create({
      data: { name: 'Volatile', price: 1_000, stock: 5, categoryId },
    });

    await user.post('/api/cart/items').send({ productId: product.id, quantity: 4 }).expect(200);

    await ctx.prisma.product.update({ where: { id: product.id }, data: { stock: 2 } });
    const insufficient = await user.get('/api/cart').expect(200);
    expect(insufficient.body).toMatchObject({ hasIssues: true });
    expect(insufficient.body.items[0]).toMatchObject({ issue: 'INSUFFICIENT_STOCK', stock: 2 });

    await ctx.prisma.product.update({ where: { id: product.id }, data: { stock: 0 } });
    const outOfStock = await user.get('/api/cart').expect(200);
    expect(outOfStock.body.items[0].issue).toBe('OUT_OF_STOCK');

    await ctx.prisma.product.update({ where: { id: product.id }, data: { stock: 10 } });
    const fixed = await user
      .patch(`/api/cart/items/${product.id}`)
      .send({ quantity: 2 })
      .expect(200);
    expect(fixed.body.hasIssues).toBe(false);
  });

  it('shows current prices and drops deleted products', async () => {
    const user = await newCustomer();
    const product = await ctx.prisma.product.create({
      data: { name: 'Repriced', price: 1_000, stock: 5, categoryId },
    });
    await user.post('/api/cart/items').send({ productId: product.id }).expect(200);

    await ctx.prisma.product.update({ where: { id: product.id }, data: { price: 1_500 } });
    expect((await user.get('/api/cart').expect(200)).body.totalAmount).toBe(1_500);

    await ctx.prisma.product.update({ where: { id: product.id }, data: { deletedAt: new Date() } });
    expect((await user.get('/api/cart').expect(200)).body.items).toEqual([]);
    await user.post('/api/cart/items').send({ productId: product.id }).expect(404);
  });

  it('handles concurrent adds of the same product without errors or lost updates', async () => {
    const user = await newCustomer();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        user.post('/api/cart/items').send({ productId: products.case, quantity: 1 }),
      ),
    );

    expect(responses.map((r) => r.status)).toEqual(Array(10).fill(200));
    const cart = await user.get('/api/cart').expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(10);
  });
});

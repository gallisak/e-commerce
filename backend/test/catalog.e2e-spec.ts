import request from 'supertest';
import { Role } from '../src/generated/prisma/client.js';
import { createTestApp, createUserAndLogin, type TestContext } from './utils/test-app.js';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Catalog (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;
  const userIds: string[] = [];
  const suffix = Math.random().toString(36).slice(2, 8);

  const api = () => request(ctx.app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    ctx = await createTestApp();
    const admin = await createUserAndLogin(ctx, Role.ADMIN);
    const customer = await createUserAndLogin(ctx, Role.CUSTOMER);
    adminToken = admin.accessToken;
    customerToken = customer.accessToken;
    userIds.push(admin.id, customer.id);

    const category = await asAdmin(api().post('/api/categories'))
      .send({ name: `E2E Catalog ${suffix}` })
      .expect(201);
    categoryId = category.body.id;
    expect(category.body.slug).toBe(`e2e-catalog-${suffix}`);

    const products = [
      { name: `Alpha Phone ${suffix}`, price: 10_000, stock: 5 },
      { name: `Beta Phone ${suffix}`, price: 30_000, stock: 0 },
      { name: `Gamma Laptop ${suffix}`, price: 50_000, stock: 2 },
      { name: `100% Cotton ${suffix}`, price: 20_000, stock: 1 },
    ];
    for (const product of products) {
      await asAdmin(api().post('/api/products'))
        .send({ ...product, categoryId })
        .expect(201);
    }
  });

  afterAll(async () => {
    await ctx.prisma.product.deleteMany({ where: { categoryId } });
    await ctx.prisma.category.deleteMany({ where: { id: categoryId } });
    await ctx.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await ctx.app.close();
  });

  const list = (query: Record<string, string | number>) =>
    api()
      .get('/api/products')
      .query({ categoryId, ...query })
      .expect(200);

  it('paginates with stable metadata', async () => {
    const first = await list({ limit: 3, page: 1 });
    const second = await list({ limit: 3, page: 2 });

    expect(first.body.meta).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(second.body.items).toHaveLength(1);
    const ids = [...first.body.items, ...second.body.items].map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('searches by name case-insensitively and treats wildcards literally', async () => {
    const phones = await list({ search: 'phone' });
    expect(phones.body.items.map((p: { name: string }) => p.name).sort()).toEqual([
      `Alpha Phone ${suffix}`,
      `Beta Phone ${suffix}`,
    ]);

    const percent = await list({ search: '100%' });
    expect(percent.body.meta.total).toBe(1);
    const wildcard = await list({ search: '%' });
    expect(wildcard.body.meta.total).toBe(1);
  });

  it('filters by price range and sorts by price', async () => {
    const asc = await list({ minPrice: 15_000, maxPrice: 50_000, sort: 'price_asc' });
    expect(asc.body.items.map((p: { price: number }) => p.price)).toEqual([20_000, 30_000, 50_000]);

    const desc = await list({ sort: 'price_desc' });
    expect(desc.body.items.map((p: { price: number }) => p.price)).toEqual([
      50_000, 30_000, 20_000, 10_000,
    ]);
  });

  it('sorts by newest by default', async () => {
    const res = await list({});
    expect(res.body.items[0].name).toBe(`100% Cotton ${suffix}`);
  });

  it('rejects invalid query parameters', async () => {
    await api().get('/api/products').query({ minPrice: 500, maxPrice: 100 }).expect(400);
    await api().get('/api/products').query({ sort: 'random', limit: 1000 }).expect(400);
    await api().get('/api/products/not-a-uuid').expect(400);
  });

  it('serves repeated reads from cache and invalidates on product change', async () => {
    const target = (await list({ search: 'Gamma' })).body.items[0];

    const listHit = await list({ search: 'Gamma' });
    expect(listHit.headers['x-cache']).toBe('HIT');

    await api().get(`/api/products/${target.id}`).expect(200);
    const itemHit = await api().get(`/api/products/${target.id}`).expect(200);
    expect(itemHit.headers['x-cache']).toBe('HIT');

    await asAdmin(api().patch(`/api/products/${target.id}`))
      .send({ stock: 42 })
      .expect(200);

    const afterUpdate = await api().get(`/api/products/${target.id}`).expect(200);
    expect(afterUpdate.headers['x-cache']).toBe('MISS');
    expect(afterUpdate.body.stock).toBe(42);

    const listAfterUpdate = await list({ search: 'Gamma' });
    expect(listAfterUpdate.headers['x-cache']).toBe('MISS');
    expect(listAfterUpdate.body.items[0].stock).toBe(42);
  });

  it('allows catalog management for admins only', async () => {
    const payload = { name: 'Forbidden', price: 1, stock: 1, categoryId };
    await api().post('/api/products').send(payload).expect(401);
    await api()
      .post('/api/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload)
      .expect(403);
    await api()
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('validates product payloads', async () => {
    const res = await asAdmin(api().post('/api/products'))
      .send({ name: 'X', price: -5, stock: 1.5, categoryId, imageUrl: 'javascript:alert(1)' })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining(['price must not be less than 0', 'imageUrl must be a URL address']),
    );

    await asAdmin(api().post('/api/products'))
      .send({
        name: 'Orphan',
        price: 1,
        stock: 1,
        categoryId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(400);
  });

  it('uploads a product image and serves it statically', async () => {
    const product = (await list({ search: 'Alpha' })).body.items[0];

    const uploaded = await asAdmin(api().post(`/api/products/${product.id}/image`))
      .attach('file', PNG_1x1, { filename: 'photo.png', contentType: 'image/png' })
      .expect(200);
    expect(uploaded.body.imageUrl).toMatch(/^\/uploads\/products\/.+\.png$/);

    await api()
      .get(uploaded.body.imageUrl)
      .expect(200)
      .expect('Content-Type', /image\/png/);

    await asAdmin(api().post(`/api/products/${product.id}/image`))
      .attach('file', Buffer.from('not an image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);

    await asAdmin(api().patch(`/api/products/${product.id}`))
      .send({ imageUrl: null })
      .expect(200);
    await api().get(uploaded.body.imageUrl).expect(404);
  });

  it('soft-deletes products and protects categories that still have products', async () => {
    const product = (await list({ search: 'Beta' })).body.items[0];

    await asAdmin(api().delete(`/api/categories/${categoryId}`)).expect(409);
    await asAdmin(api().delete(`/api/products/${product.id}`)).expect(204);

    await api().get(`/api/products/${product.id}`).expect(404);
    await asAdmin(api().patch(`/api/products/${product.id}`))
      .send({ stock: 1 })
      .expect(404);
    expect((await list({})).body.meta.total).toBe(3);

    const stored = await ctx.prisma.product.findUnique({ where: { id: product.id } });
    expect(stored?.deletedAt).not.toBeNull();
  });
});

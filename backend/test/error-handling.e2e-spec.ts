import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Prisma, Role } from '../src/generated/prisma/client.js';
import { ProductsRepository } from '../src/products/products.repository.js';
import { createTestApp, createUserAndLogin, type TestContext } from './utils/test-app.js';

const UUID = /^[0-9a-f-]{36}$/;

describe('Error handling (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    const admin = await createUserAndLogin(ctx, Role.ADMIN);
    adminToken = admin.accessToken;
    adminId = admin.id;
  });

  afterAll(async () => {
    await ctx.prisma.user.delete({ where: { id: adminId } });
    await ctx.app.close();
  });

  const api = () => request(ctx.app.getHttpServer());

  it('returns a uniform error body with a request id for unknown routes', async () => {
    const res = await api().get('/api/does-not-exist').expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/does-not-exist',
      path: '/api/does-not-exist',
      timestamp: expect.any(String),
      requestId: expect.stringMatching(UUID),
    });
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('propagates a client supplied request id and rejects malformed ones', async () => {
    const kept = await api()
      .get('/api/products?limit=1')
      .set('X-Request-Id', 'trace-0001-abcd')
      .expect(200);
    expect(kept.headers['x-request-id']).toBe('trace-0001-abcd');

    const replaced = await api().get('/api/nope').set('X-Request-Id', 'bad id').expect(404);
    expect(replaced.body.requestId).toMatch(UUID);
  });

  it('keeps validation details and domain fields in the same envelope', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'x' }).expect(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.arrayContaining(['email must be an email']),
      requestId: expect.stringMatching(UUID),
    });
  });

  it('maps malformed and oversized JSON bodies to 4xx', async () => {
    await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{broken')
      .expect(400);

    const oversized = await api()
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(200_000) })
      .expect(413);
    expect(oversized.body).toMatchObject({ statusCode: 413, error: 'Payload Too Large' });
  });

  it('rejects control characters in catalog names', async () => {
    const category = await api()
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Forged\n[Nest] LOG fake' })
      .expect(400);
    expect(category.body.message).toEqual([
      'name must not contain line breaks or control characters',
    ]);
  });

  it.each([
    ['patch', '/api/products/:id', { price: null }, 'price must be an integer number'],
    ['patch', '/api/products/:id', { description: null }, 'description must be a string'],
    ['patch', '/api/categories/:id', { name: null }, 'name must be a string'],
    [
      'post',
      '/api/cart/items',
      { productId: ':id', quantity: null },
      'quantity must be an integer number',
    ],
  ] as const)('rejects null in %s %s with 400', async (method, path, body, expected) => {
    const id = randomUUID();
    const payload = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, value === ':id' ? id : value]),
    );
    const res = await api()
      [method](path.replace(':id', id))
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(400);
    expect(res.body.message).toContain(expected);
  });
});

describe('Error handling when the database is unavailable (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder.overrideProvider(ProductsRepository).useValue({
        search: async () => {
          throw new Prisma.PrismaClientKnownRequestError('connect ECONNREFUSED 127.0.0.1:5432', {
            code: 'ECONNREFUSED',
            clientVersion: 'test',
          });
        },
        findActiveById: async () => {
          throw new Error('Unexpected internal failure with secret details');
        },
      }),
    );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('responds with 503 instead of leaking a 500', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/products')
      .query({ search: `outage-${Date.now()}` })
      .expect(503);
    expect(res.body).toMatchObject({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Service temporarily unavailable',
    });
  });

  it('hides internal error details behind a generic 500', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/products/${randomUUID()}`)
      .expect(500);
    expect(res.body.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toContain('secret details');
  });
});

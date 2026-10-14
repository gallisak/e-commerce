import request from 'supertest';
import { REFRESH_TOKEN_COOKIE } from '../src/auth/auth.constants.js';
import { createTestApp, resetThrottling, type TestContext, uniqueEmail } from './utils/test-app.js';

const refreshCookieFrom = (res: request.Response): string => {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
  if (!cookie) throw new Error('refresh cookie was not set');
  return cookie.split(';')[0];
};

describe('Auth (e2e)', () => {
  let ctx: TestContext;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetThrottling(ctx.redis);
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await ctx.app.close();
  });

  const register = (email: string, password = 'Secret123') => {
    createdEmails.push(email);
    return request(ctx.app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, name: 'E2E User', password });
  };

  it('registers, reads profile, rotates refresh token, detects reuse and logs out', async () => {
    const server = ctx.app.getHttpServer();
    const email = uniqueEmail();

    const registered = await register(email).expect(201);
    expect(registered.body.user).toMatchObject({ email, role: 'CUSTOMER' });
    expect(registered.body.user).not.toHaveProperty('passwordHash');
    const setCookie = ([] as string[]).concat(registered.headers['set-cookie']).join(';');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/api\/auth/);

    await request(server)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .expect(200)
      .expect((res) => expect(res.body.email).toBe(email));

    const firstCookie = refreshCookieFrom(registered);
    const refreshed = await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    const secondCookie = refreshCookieFrom(refreshed);
    expect(secondCookie).not.toBe(firstCookie);

    await request(server).post('/api/auth/refresh').set('Cookie', firstCookie).expect(401);
    await request(server).post('/api/auth/refresh').set('Cookie', secondCookie).expect(401);

    const loggedIn = await request(server)
      .post('/api/auth/login')
      .send({ email, password: 'Secret123' })
      .expect(200);
    const loginCookie = refreshCookieFrom(loggedIn);

    await request(server).post('/api/auth/logout').set('Cookie', loginCookie).expect(204);
    await request(server).post('/api/auth/refresh').set('Cookie', loginCookie).expect(401);
  });

  it('rejects duplicate registration with 409', async () => {
    const email = uniqueEmail();
    await register(email).expect(201);
    await register(email.toUpperCase()).expect(409);
  });

  it('validates the payload and rejects unknown fields such as role', async () => {
    const res = await register(uniqueEmail())
      .send({ email: 'not-an-email', name: 'X', password: 'short', role: 'ADMIN' })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining(['property role should not exist', 'email must be an email']),
    );
  });

  it('returns the same 401 for wrong password and unknown email', async () => {
    const email = uniqueEmail();
    await register(email).expect(201);
    const server = ctx.app.getHttpServer();

    const wrongPassword = await request(server)
      .post('/api/auth/login')
      .send({ email, password: 'Wrong1234' })
      .expect(401);
    const unknownEmail = await request(server)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('missing'), password: 'Wrong1234' })
      .expect(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('rate-limits login attempts', async () => {
    const server = ctx.app.getHttpServer();
    const attempt = () =>
      request(server).post('/api/auth/login').send({ email: uniqueEmail(), password: 'Wrong1234' });

    for (let i = 0; i < 5; i++) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.headers['retry-after-login']).toBeDefined();
  });

  it('requires a valid access token for protected routes', async () => {
    const server = ctx.app.getHttpServer();
    await request(server).get('/api/users/me').expect(401);
    await request(server).get('/api/users/me').set('Authorization', 'Bearer garbage').expect(401);
  });
});

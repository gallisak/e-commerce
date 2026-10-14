import request from 'supertest';
import { createTestApp, type TestContext } from './utils/test-app.js';

describe('Health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/health reports database status', () => {
    return request(ctx.app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok', database: 'up', redis: 'up' });
  });
});

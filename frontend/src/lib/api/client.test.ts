import { authHeader, errorBody, mockApi } from '@/test/http';
import { api, REFRESH_LOCK_NAME, refreshSession } from './client';
import { ApiError } from './errors';
import { session } from './session';
import type { User } from './types';

const user: User = {
  id: 'u-1',
  email: 'customer@example.com',
  name: 'Demo Customer',
  role: 'CUSTOMER',
  createdAt: '2026-10-01T00:00:00.000Z',
};

const refreshed = (token: string) => ({
  status: 200,
  data: { accessToken: token, expiresIn: 900, user },
});

describe('api client', () => {
  let mock: ReturnType<typeof mockApi> | undefined;

  beforeEach(() => session.reset());
  afterEach(() => mock?.restore());

  it('sends the access token from the session', async () => {
    session.signIn(user, 'token-1');
    mock = mockApi(() => ({ status: 200, data: {} }));

    await api.get('/users/me');

    expect(authHeader(mock.calls[0])).toBe('Bearer token-1');
  });

  it('refreshes once for concurrent 401 responses and retries each request', async () => {
    session.signIn(user, 'expired');
    mock = mockApi(async (config) => {
      if (config.url === '/auth/refresh') {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return refreshed('fresh');
      }
      return authHeader(config) === 'Bearer fresh'
        ? { status: 200, data: { url: config.url } }
        : { status: 401, data: errorBody(401, 'Invalid or expired access token') };
    });

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(results.map((r) => r.data.url)).toEqual(['/a', '/b', '/c']);
    expect(mock.calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
    expect(session.getState()).toMatchObject({ status: 'authenticated', accessToken: 'fresh' });
  });

  it('signs out and rethrows the original error when the refresh token is rejected', async () => {
    session.signIn(user, 'expired');
    mock = mockApi((config) =>
      config.url === '/auth/refresh'
        ? { status: 401, data: errorBody(401, 'Invalid refresh token') }
        : { status: 401, data: errorBody(401, 'Invalid or expired access token') },
    );

    const error = await api.get('/cart').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(session.getState()).toEqual({ status: 'anonymous', user: null, accessToken: null });
  });

  it('does not try to refresh for requests that opt out', async () => {
    mock = mockApi(() => ({ status: 401, data: errorBody(401, 'Invalid email or password') }));

    await expect(api.post('/auth/login', {}, { skipAuthRefresh: true })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });
    expect(mock.calls).toHaveLength(1);
  });

  it('retries a request only once', async () => {
    mock = mockApi((config) =>
      config.url === '/auth/refresh'
        ? refreshed('fresh')
        : { status: 401, data: errorBody(401, 'Still unauthorized') },
    );

    await expect(api.get('/orders')).rejects.toMatchObject({ status: 401 });
    expect(mock.calls.map((c) => c.url)).toEqual(['/orders', '/auth/refresh', '/orders']);
  });

  it('keeps the session when refresh fails for a non-auth reason', async () => {
    session.signIn(user, 'token-1');
    mock = mockApi(() => ({
      status: 503,
      data: errorBody(503, 'Service temporarily unavailable'),
    }));

    await expect(refreshSession()).rejects.toMatchObject({ status: 503 });
    expect(session.getState().status).toBe('authenticated');
  });

  it('serialises refreshes across tabs with the Web Locks API', async () => {
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    mock = mockApi(() => refreshed('fresh'));

    try {
      await refreshSession();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(request).toHaveBeenCalledWith(REFRESH_LOCK_NAME, expect.any(Function));
  });

  it('reads JSON error bodies of blob downloads', async () => {
    session.signIn(user, 'token-1');
    mock = mockApi(() => ({
      status: 400,
      data: new Blob([JSON.stringify(errorBody(400, 'Date range must not exceed 366 days'))], {
        type: 'application/json',
      }),
    }));

    const error = await api.get('/report.csv', { responseType: 'blob' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).messages).toEqual(['Date range must not exceed 366 days']);
  });
});

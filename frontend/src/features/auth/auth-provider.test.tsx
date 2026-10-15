import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { createQueryClient } from '@/app/query-client';
import { session } from '@/lib/api/session';
import { sessionHint } from '@/lib/api/session-hint';
import { errorBody, mockApi } from '@/test/http';
import { customer } from '@/test/render';
import { AuthProvider } from './auth-provider';
import { useAuth } from './use-auth';

function Probe() {
  const { status, user, logout } = useAuth();
  return (
    <div>
      <p>status: {status}</p>
      <p>user: {user?.email ?? 'none'}</p>
      <button onClick={() => logout().catch(() => undefined)}>logout</button>
    </div>
  );
}

function renderProvider() {
  const client = createQueryClient();
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return client;
}

describe('AuthProvider', () => {
  let mock: ReturnType<typeof mockApi> | undefined;

  beforeEach(() => {
    session.reset();
    sessionHint.set();
  });
  afterEach(() => mock?.restore());

  it('restores the session with a single refresh request, even in StrictMode', async () => {
    mock = mockApi(() => ({
      status: 200,
      data: { accessToken: 'token', expiresIn: 900, user: customer },
    }));

    renderProvider();

    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
    expect(screen.getByText('user: customer@example.com')).toBeInTheDocument();
    expect(mock.calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
  });

  it('skips the refresh request for visitors who never signed in', async () => {
    sessionHint.clear();
    mock = mockApi(() => ({ status: 500 }));
    renderProvider();
    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(mock.calls).toHaveLength(0);
  });

  it('becomes anonymous and forgets the hint when the refresh cookie is invalid', async () => {
    mock = mockApi(() => ({ status: 401, data: errorBody(401, 'Invalid refresh token') }));
    renderProvider();
    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(sessionHint.has()).toBe(false);
  });

  it('becomes anonymous when the server is unreachable at start-up', async () => {
    mock = mockApi(() => ({
      status: 503,
      data: errorBody(503, 'Service temporarily unavailable'),
    }));
    renderProvider();
    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
  });

  it('clears the session and cached data on logout even if the request fails', async () => {
    session.signIn(customer, 'token');
    mock = mockApi(() => ({ status: 503, data: errorBody(503, 'down') }));
    const client = renderProvider();
    client.setQueryData(['users', 'me'], customer);

    await act(async () => screen.getByRole('button', { name: 'logout' }).click());

    await waitFor(() => expect(screen.getByText('status: anonymous')).toBeInTheDocument());
    expect(client.getQueryData(['users', 'me'])).toBeUndefined();
    expect(sessionHint.has()).toBe(false);
    expect(mock.calls.map((c) => c.url)).toEqual(['/auth/logout']);
  });
});

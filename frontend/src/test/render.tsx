import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { createQueryClient } from '@/app/query-client';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import type { User } from '@/lib/api/types';

export const customer: User = {
  id: 'u-customer',
  email: 'customer@example.com',
  name: 'Demo Customer',
  role: 'CUSTOMER',
  createdAt: '2026-10-01T00:00:00.000Z',
};

export const admin: User = {
  ...customer,
  id: 'u-admin',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
};

export function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const user = overrides.user === undefined ? null : overrides.user;
  return {
    status: user ? 'authenticated' : 'anonymous',
    user,
    isAdmin: user?.role === 'ADMIN',
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

export function renderRoutes(
  routes: RouteObject[],
  { path = '/', auth = authValue() }: { path?: string; auth?: AuthContextValue } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

export function renderPage(
  element: ReactElement,
  options?: { path?: string; auth?: AuthContextValue },
) {
  return renderRoutes([{ path: '*', element }], options);
}

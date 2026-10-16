import { screen } from '@testing-library/react';
import { mockApi } from '@/test/http';
import { admin, authValue, customer, renderRoutes } from '@/test/render';
import { adminRoute } from './admin-routes';

describe('admin routes', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('loads the admin panel lazily for administrators', async () => {
    restore = mockApi(() => ({ status: 200, data: [] })).restore;
    renderRoutes([adminRoute], { path: '/admin/categories', auth: authValue({ user: admin }) });

    const nav = await screen.findByRole('navigation', { name: 'Admin' });
    expect(nav).toHaveTextContent('Dashboard');
    expect(nav).toHaveTextContent('Products');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Categories' }),
    ).toBeInTheDocument();
  });

  it('denies access to customers', async () => {
    const mock = mockApi(() => ({ status: 200, data: [] }));
    restore = mock.restore;
    renderRoutes([adminRoute], { path: '/admin/products', auth: authValue({ user: customer }) });

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument();
    expect(mock.calls).toHaveLength(0);
  });
});

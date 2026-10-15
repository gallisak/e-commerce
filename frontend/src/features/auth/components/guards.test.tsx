import { screen } from '@testing-library/react';
import { useLocation } from 'react-router';
import { admin, authValue, customer, renderRoutes } from '@/test/render';
import { GuestOnly, RequireAdmin, RequireAuth } from './guards';

function CurrentLocation() {
  const location = useLocation();
  return <p>at {`${location.pathname}${location.search}`}</p>;
}

const routes = [
  {
    path: '/login',
    element: (
      <GuestOnly>
        <CurrentLocation />
      </GuestOnly>
    ),
  },
  {
    path: '/account',
    element: (
      <RequireAuth>
        <p>account content</p>
      </RequireAuth>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <p>admin content</p>
      </RequireAdmin>
    ),
  },
  { path: '*', element: <CurrentLocation /> },
];

describe('route guards', () => {
  it('sends anonymous visitors to the login page with a return path', async () => {
    renderRoutes(routes, { path: '/account?tab=orders' });
    expect(
      await screen.findByText('at /login?redirect=%2Faccount%3Ftab%3Dorders'),
    ).toBeInTheDocument();
  });

  it('waits for the session check instead of redirecting', () => {
    renderRoutes(routes, { path: '/account', auth: authValue({ status: 'pending' }) });
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
  });

  it('shows protected content to signed-in users', () => {
    renderRoutes(routes, { path: '/account', auth: authValue({ user: customer }) });
    expect(screen.getByText('account content')).toBeInTheDocument();
  });

  it('denies the admin area to customers', () => {
    renderRoutes(routes, { path: '/admin', auth: authValue({ user: customer }) });
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('lets admins into the admin area', () => {
    renderRoutes(routes, { path: '/admin', auth: authValue({ user: admin }) });
    expect(screen.getByText('admin content')).toBeInTheDocument();
  });

  it('sends signed-in users away from the login page to a safe return path', async () => {
    renderRoutes(routes, {
      path: '/login?redirect=https%3A%2F%2Fevil.example',
      auth: authValue({ user: customer }),
    });
    expect(await screen.findByText('at /')).toBeInTheDocument();
  });

  it('returns signed-in users to the requested page', async () => {
    renderRoutes(routes, {
      path: '/login?redirect=%2Forders%3Fpage%3D2',
      auth: authValue({ user: customer }),
    });
    expect(await screen.findByText('at /orders?page=2')).toBeInTheDocument();
  });
});

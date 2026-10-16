import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { orderSummary, page } from '@/test/fixtures';
import { errorBody, mockApi, type MockHandler } from '@/test/http';
import { authValue, customer, renderRoutes } from '@/test/render';
import { OrderHistory } from './order-history';

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

const routes = [
  {
    path: '/account',
    element: (
      <>
        <OrderHistory />
        <LocationProbe />
      </>
    ),
  },
];

function setup(handler: MockHandler, path = '/account') {
  const mock = mockApi(handler);
  renderRoutes(routes, { path, auth: authValue({ user: customer }) });
  return mock;
}

const orders = [
  orderSummary({ status: 'PROCESSING', itemsCount: 2 }),
  orderSummary({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'CANCELLED' }),
];

describe('OrderHistory', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('lists orders with links, status and totals', async () => {
    restore = setup(() => ({ status: 200, data: page(orders) })).restore;

    const list = await screen.findByRole('list', { name: 'Orders' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', `/account/orders/${orders[0].id}`);
    expect(links[0]).toHaveTextContent('Order #DDDDDDDD');
    expect(links[0]).toHaveTextContent('Processing');
    expect(links[0]).toHaveTextContent('2 products');
    expect(links[0]).toHaveTextContent('₴1,198.00');
    expect(links[1]).toHaveTextContent('Cancelled');
  });

  it('filters by status through the URL', async () => {
    const mock = setup(() => ({ status: 200, data: page(orders) }), '/account?page=2');
    restore = mock.restore;
    await screen.findByRole('list', { name: 'Orders' });
    expect(mock.calls.at(-1)?.params).toEqual({ page: 2, limit: 10 });

    await userEvent.click(screen.getByRole('combobox', { name: 'Filter by status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cancelled' }));

    expect(screen.getByTestId('location')).toHaveTextContent('?status=CANCELLED');
    expect(mock.calls.at(-1)?.params).toEqual({ page: 1, status: 'CANCELLED', limit: 10 });
  });

  it('ignores an unknown status in the URL', async () => {
    const mock = setup(() => ({ status: 200, data: page(orders) }), '/account?status=LOST');
    restore = mock.restore;
    await screen.findByRole('list', { name: 'Orders' });
    expect(mock.calls[0].params).toEqual({ page: 1, limit: 10 });
  });

  it('invites to shop when there are no orders', async () => {
    restore = setup(() => ({ status: 200, data: page([]) })).restore;
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/');
  });

  it('offers to reset an empty status filter', async () => {
    restore = setup(() => ({ status: 200, data: page([]) }), '/account?status=SHIPPED').restore;
    expect(await screen.findByText('No shipped orders')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('?status=SHIPPED');
    await userEvent.click(screen.getByRole('button', { name: 'Show all orders' }));
    expect(screen.getByTestId('location').textContent).toBe('');
  });

  it('paginates and keeps the filter', async () => {
    restore = setup(
      () => ({ status: 200, data: page(orders, { total: 25, totalPages: 3 }) }),
      '/account?status=PROCESSING',
    ).restore;
    const nav = await screen.findByRole('navigation', { name: 'Order pages' });
    expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'href',
      '/account?status=PROCESSING&page=2',
    );
  });

  it('shows an error with retry', async () => {
    restore = setup(() => ({ status: 500, data: errorBody(500, 'boom') })).restore;
    expect(await screen.findByText('Could not load your orders')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

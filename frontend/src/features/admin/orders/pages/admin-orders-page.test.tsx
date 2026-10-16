import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { orderSummary, page } from '@/test/fixtures';
import { errorBody, mockApi, type MockHandler } from '@/test/http';
import { admin, authValue, renderRoutes } from '@/test/render';
import { AdminOrdersPage } from './admin-orders-page';

function SearchProbe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const routes = [
  { path: '/admin/orders', element: [<AdminOrdersPage key="page" />, <SearchProbe key="probe" />] },
];

const orders = [
  orderSummary({ status: 'PROCESSING', itemsCount: 3 }),
  orderSummary({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'NEW' }),
];

function setup(handler: MockHandler, path = '/admin/orders') {
  const mock = mockApi(handler);
  renderRoutes(routes, { path, auth: authValue({ user: admin }) });
  return mock;
}

describe('AdminOrdersPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('lists orders with customer, total and status', async () => {
    restore = setup(() => ({ status: 200, data: page(orders) })).restore;

    const table = await screen.findByRole('table', { name: 'Orders' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole('link', { name: '#DDDDDDDD' })).toHaveAttribute(
      'href',
      `/admin/orders/${orders[0].id}`,
    );
    expect(rows[1]).toHaveTextContent('customer@example.com');
    expect(rows[1]).toHaveTextContent('3 products');
    expect(rows[1]).toHaveTextContent('₴1,198.00');
    expect(rows[1]).toHaveTextContent('Processing');
    expect(screen.getByText('2 orders')).toBeInTheDocument();
  });

  it('sends URL filters to the API with an exclusive end date', async () => {
    const mock = setup(
      () => ({ status: 200, data: page(orders) }),
      '/admin/orders?status=NEW&from=2026-10-01&to=2026-10-31&page=2',
    );
    restore = mock.restore;

    await screen.findByRole('table', { name: 'Orders' });
    expect(mock.calls[0].params).toEqual({
      page: 2,
      status: 'NEW',
      from: '2026-10-01',
      to: '2026-11-01',
      limit: 20,
    });
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    expect(screen.getByRole('link', { name: 'Reset filters' })).toHaveAttribute(
      'href',
      '/admin/orders',
    );
  });

  it('ignores invalid dates in the URL', async () => {
    const mock = setup(
      () => ({ status: 200, data: page(orders) }),
      '/admin/orders?from=2026-10-10&to=2026-10-01&status=LOST',
    );
    restore = mock.restore;
    await screen.findByRole('table', { name: 'Orders' });
    expect(mock.calls[0].params).toEqual({ page: 1, from: '2026-10-10', limit: 20 });
  });

  it('applies the date range and validates it', async () => {
    restore = setup(() => ({ status: 200, data: page(orders) }), '/admin/orders?page=3').restore;
    await screen.findByRole('table', { name: 'Orders' });

    await userEvent.type(screen.getByLabelText('From'), '2026-10-10');
    await userEvent.type(screen.getByLabelText('To'), '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The start date must not be after the end date',
    );
    expect(screen.getByTestId('search')).toHaveTextContent('?page=3');

    await userEvent.clear(screen.getByLabelText('To'));
    await userEvent.type(screen.getByLabelText('To'), '2026-10-12');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?from=2026-10-10&to=2026-10-12');
  });

  it('filters by status and resets the page', async () => {
    const mock = setup(() => ({ status: 200, data: page(orders) }), '/admin/orders?page=2');
    restore = mock.restore;
    await screen.findByRole('table', { name: 'Orders' });

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Shipped' }));

    expect(screen.getByTestId('search')).toHaveTextContent('?status=SHIPPED');
    expect(mock.calls.at(-1)?.params).toMatchObject({ page: 1, status: 'SHIPPED' });
  });

  it('shows empty and error states', async () => {
    restore = setup(
      () => ({ status: 200, data: page([]) }),
      '/admin/orders?status=SHIPPED',
    ).restore;
    expect(await screen.findByText('No orders match the filters')).toBeInTheDocument();
    restore();

    restore = setup(() => ({ status: 500, data: errorBody(500, 'boom') })).restore;
    expect(await screen.findByText('Could not load orders')).toBeInTheDocument();
  });
});

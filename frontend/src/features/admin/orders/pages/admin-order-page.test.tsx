import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrderDetail } from '@/lib/api/types';
import { ORDER_ID, order } from '@/test/fixtures';
import { errorBody, mockApi, type MockHandler } from '@/test/http';
import { admin, authValue, renderRoutes } from '@/test/render';
import { AdminOrderPage } from './admin-order-page';

const routes = [{ path: '/admin/orders/:orderId', element: <AdminOrderPage /> }];

function setup(handler: MockHandler, path = `/admin/orders/${ORDER_ID}`) {
  const mock = mockApi(handler);
  renderRoutes(routes, { path, auth: authValue({ user: admin }) });
  return mock;
}

function withStatus(status: OrderDetail['status'], note: string | null = null): OrderDetail {
  const base = order();
  return {
    ...base,
    status,
    cancelReason: status === 'CANCELLED' ? note : null,
    statusHistory: [
      ...base.statusHistory,
      {
        fromStatus: 'NEW',
        toStatus: status,
        note,
        byUser: true,
        createdAt: '2026-10-10T10:00:00.000Z',
      },
    ],
  };
}

describe('AdminOrderPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('shows the order with customer details', async () => {
    restore = setup(() => ({ status: 200, data: withStatus('PROCESSING') })).restore;

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Order #DDDDDDDD');
    expect(screen.getByText('customer@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 Test Street, Kyiv')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Order items' })).toHaveTextContent('2 × ₴599.00');
  });

  it('offers only the allowed transitions', async () => {
    restore = setup(() => ({ status: 200, data: withStatus('PROCESSING') })).restore;

    await userEvent.click(await screen.findByRole('combobox', { name: 'New status' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Shipped', 'Cancelled']);
  });

  it('changes the status with a note', async () => {
    let current = withStatus('PROCESSING');
    const mock = setup((config) => {
      if (config.method === 'patch') {
        const { status, note } = JSON.parse(config.data);
        current = { ...withStatus(status, note) };
        return { status: 200, data: current };
      }
      return { status: 200, data: current };
    });
    restore = mock.restore;

    await userEvent.type(await screen.findByLabelText('Note (optional)'), 'TTN 2045');
    await userEvent.click(screen.getByRole('button', { name: 'Mark as shipped' }));

    expect(await screen.findByText('Order marked as shipped')).toBeInTheDocument();
    const patch = mock.calls.find((call) => call.method === 'patch');
    expect(patch?.url).toBe(`/admin/orders/${ORDER_ID}/status`);
    expect(JSON.parse(patch?.data)).toEqual({ status: 'SHIPPED', note: 'TTN 2045' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shipped');
    expect(screen.getByRole('list', { name: 'Status history' })).toHaveTextContent('TTN 2045');
    expect(screen.getByRole('button', { name: 'Mark as completed' })).toBeInTheDocument();
    expect(screen.getByLabelText('Note (optional)')).toHaveValue('');
  });

  it('asks for confirmation before cancelling', async () => {
    let current = withStatus('PROCESSING');
    const mock = setup((config) => {
      if (config.method === 'patch')
        current = withStatus('CANCELLED', JSON.parse(config.data).note);
      return { status: 200, data: current };
    });
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('combobox', { name: 'New status' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cancelled' }));
    expect(
      screen.getByText('Shown to the customer as the cancellation reason.'),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'Out of stock');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(mock.calls.some((call) => call.method === 'patch')).toBe(false);

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

    expect(await screen.findByText('Order marked as cancelled')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText('This order is cancelled. Its status can no longer be changed.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
  });

  it('reports a conflict and reloads the order', async () => {
    let current = withStatus('PROCESSING');
    const mock = setup((config) => {
      if (config.method === 'patch') {
        current = withStatus('CANCELLED', 'Cancelled by customer');
        return {
          status: 409,
          data: errorBody(409, 'Cannot change order status from CANCELLED to SHIPPED'),
        };
      }
      return { status: 200, data: current };
    });
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Mark as shipped' }));

    expect(
      await screen.findByText('Cannot change order status from CANCELLED to SHIPPED'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cancelled'),
    );
  });

  it('waits for the payment of a new order', async () => {
    restore = setup(() => ({ status: 200, data: order() })).restore;
    expect(await screen.findByText('Waiting for the payment to be processed…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as processing' })).toBeInTheDocument();
  });

  it('shows not found', async () => {
    restore = setup(() => ({ status: 404, data: errorBody(404, 'Order not found') })).restore;
    expect(await screen.findByText('Order not found')).toBeInTheDocument();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrderDetail } from '@/lib/api/types';
import { ORDER_ID, order } from '@/test/fixtures';
import { errorBody, mockApi, type MockHandler } from '@/test/http';
import { authValue, customer, renderRoutes } from '@/test/render';
import { OrderPage } from './order-page';

const routes = [{ path: '/account/orders/:orderId', element: <OrderPage /> }];

function setup(handler: MockHandler, path = `/account/orders/${ORDER_ID}`) {
  const mock = mockApi(handler);
  renderRoutes(routes, { path, auth: authValue({ user: customer }) });
  return mock;
}

const processing: OrderDetail = order({
  status: 'PROCESSING',
  statusHistory: [
    ...order().statusHistory,
    {
      fromStatus: 'NEW',
      toStatus: 'PROCESSING',
      note: 'Payment captured (mock_1)',
      byUser: false,
      createdAt: '2026-10-10T09:00:02.000Z',
    },
  ],
});

describe('OrderPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('shows the items, address and history', async () => {
    restore = setup(() => ({ status: 200, data: processing })).restore;

    expect(
      await screen.findByRole('heading', { level: 1, name: /Order #DDDDDDDD/ }),
    ).toHaveTextContent('Processing');
    expect(screen.getByRole('list', { name: 'Order items' })).toHaveTextContent('2 × ₴599.00');
    expect(screen.getByText('1 Test Street, Kyiv')).toBeInTheDocument();
    const history = screen.getByRole('list', { name: 'Status history' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(2);
    expect(history).toHaveTextContent('Payment captured (mock_1)');
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    expect(document.title).toBe('Order DDDDDDDD · Mini Marketplace');
  });

  it('polls a new order until the payment is processed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let current = order();
      const mock = setup(() => ({ status: 200, data: current }));
      restore = mock.restore;

      expect(await screen.findByText('Payment is being processed…')).toBeInTheDocument();
      current = processing;
      await vi.advanceTimersByTimeAsync(2_100);

      await waitFor(() =>
        expect(screen.queryByText('Payment is being processed…')).not.toBeInTheDocument(),
      );
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Processing');
      const calls = mock.calls.length;
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mock.calls).toHaveLength(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a new order with a reason', async () => {
    const mock = setup((config) =>
      config.method === 'post'
        ? {
            status: 200,
            data: order({ status: 'CANCELLED', cancelReason: JSON.parse(config.data).reason }),
          }
        : { status: 200, data: order() },
    );
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), 'Changed my mind');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

    expect(await screen.findByText('This order was cancelled')).toBeInTheDocument();
    expect(screen.getByText('Changed my mind')).toBeInTheDocument();
    const cancel = mock.calls.find((call) => call.method === 'post');
    expect(cancel?.url).toBe(`/orders/${ORDER_ID}/cancel`);
    expect(JSON.parse(cancel?.data)).toEqual({ reason: 'Changed my mind' });
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('keeps the dialog open and reports when cancelling is no longer possible', async () => {
    let status: OrderDetail['status'] = 'NEW';
    const mock = setup((config) => {
      if (config.method === 'post') {
        status = 'PROCESSING';
        return {
          status: 409,
          data: errorBody(
            409,
            'Order in status PROCESSING can no longer be cancelled by the customer',
          ),
        };
      }
      return { status: 200, data: status === 'NEW' ? order() : processing };
    });
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }));

    expect(
      await screen.findByText(
        'Order in status PROCESSING can no longer be cancelled by the customer',
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Processing'),
    );
  });

  it('shows not found for foreign or missing orders', async () => {
    restore = setup(() => ({ status: 404, data: errorBody(404, 'Order not found') })).restore;
    expect(await screen.findByText('Order not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to my orders' })).toHaveAttribute(
      'href',
      '/account',
    );
  });

  it('does not call the API for a malformed id', async () => {
    const mock = setup(() => ({ status: 200, data: order() }), '/account/orders/42');
    restore = mock.restore;
    expect(await screen.findByText('Order not found')).toBeInTheDocument();
    expect(mock.calls).toHaveLength(0);
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InternalAxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router';
import { cart, cartItem, order } from '@/test/fixtures';
import { errorBody, mockApi, type MockReply } from '@/test/http';
import { authValue, customer, renderRoutes } from '@/test/render';
import { CheckoutPage } from './checkout-page';

function OrderProbe() {
  const location = useLocation();
  return (
    <p data-testid="order-route">
      {location.pathname} placed={String((location.state as { placed?: boolean })?.placed)}
    </p>
  );
}

const routes = [
  { path: '/checkout', element: <CheckoutPage /> },
  { path: '/account/orders/:orderId', element: <OrderProbe /> },
];

const items = [cartItem({ quantity: 2 })];

function setup(onOrder: (config: InternalAxiosRequestConfig) => MockReply, initial = cart(items)) {
  const mock = mockApi((config) =>
    config.url === '/cart' ? { status: 200, data: initial } : onOrder(config),
  );
  renderRoutes(routes, { path: '/checkout', auth: authValue({ user: customer }) });
  const orderCalls = () => mock.calls.filter((call) => call.url === '/orders');
  return { mock, orderCalls };
}

const address = () => screen.getByLabelText('Shipping address');
const placeOrder = () => screen.getByRole('button', { name: /^Place order/ });

describe('CheckoutPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('summarises the cart', async () => {
    restore = setup(() => ({ status: 201, data: order() })).mock.restore;

    expect(await screen.findByRole('button', { name: 'Place order · ₴1,198.00' })).toBeEnabled();
    expect(screen.getByRole('list', { name: 'Order items' })).toHaveTextContent('2 × ₴599.00');
  });

  it('validates the address before submitting', async () => {
    const { mock, orderCalls } = setup(() => ({ status: 201, data: order() }));
    restore = mock.restore;

    await userEvent.type(await screen.findByLabelText('Shipping address'), 'Kyiv');
    await userEvent.click(placeOrder());

    expect(
      await screen.findByText('Enter the full shipping address (at least 5 characters)'),
    ).toBeInTheDocument();
    expect(orderCalls()).toHaveLength(0);
  });

  it('places the order with an idempotency key and opens it', async () => {
    const { mock, orderCalls } = setup(() => ({ status: 201, data: order() }));
    restore = mock.restore;

    await userEvent.type(
      await screen.findByLabelText('Shipping address'),
      '  1 Test Street, Kyiv ',
    );
    await userEvent.click(placeOrder());

    expect(await screen.findByTestId('order-route')).toHaveTextContent(
      `/account/orders/${order().id} placed=true`,
    );
    const [call] = orderCalls();
    expect(JSON.parse(call.data)).toEqual({ shippingAddress: '1 Test Street, Kyiv' });
    expect(call.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{32,36}$/);
    expect(await screen.findByText('Order placed')).toBeInTheDocument();
  });

  it('retries with the same idempotency key after a network failure', async () => {
    let attempt = 0;
    const { mock, orderCalls } = setup(() =>
      ++attempt === 1
        ? { status: 503, data: errorBody(503, 'down') }
        : { status: 201, data: order() },
    );
    restore = mock.restore;

    await userEvent.type(await screen.findByLabelText('Shipping address'), '1 Test Street, Kyiv');
    await userEvent.click(placeOrder());
    expect(
      await screen.findByText('The service is temporarily unavailable. Please try again later.'),
    ).toBeInTheDocument();

    await userEvent.click(placeOrder());
    await screen.findByTestId('order-route');
    const [first, second] = orderCalls().map((call) => call.headers.get('Idempotency-Key'));
    expect(second).toBe(first);
  });

  it('lists the items that ran out while checking out', async () => {
    const { mock } = setup(() => ({
      status: 409,
      data: errorBody(409, 'Some items are not available in the requested quantity', {
        items: [{ productId: items[0].productId, name: 'Clean Code', requested: 2, available: 1 }],
      }),
    }));
    restore = mock.restore;

    await userEvent.type(await screen.findByLabelText('Shipping address'), '1 Test Street, Kyiv');
    await userEvent.click(placeOrder());

    expect(await screen.findByText('Some items are no longer available')).toBeInTheDocument();
    expect(screen.getByText('Clean Code: you asked for 2, only 1 left')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review the cart' })).toHaveAttribute('href', '/cart');
    await waitFor(() =>
      expect(mock.calls.filter((call) => call.url === '/cart').length).toBeGreaterThan(1),
    );
  });

  it('maps server validation errors to the field', async () => {
    const { mock } = setup(() => ({
      status: 400,
      data: errorBody(400, ['shippingAddress must not contain line breaks or control characters']),
    }));
    restore = mock.restore;

    await userEvent.type(await screen.findByLabelText('Shipping address'), '1 Test Street, Kyiv');
    await userEvent.click(placeOrder());

    expect(
      await screen.findByText('ShippingAddress must not contain line breaks or control characters'),
    ).toBeInTheDocument();
    expect(address()).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows an empty state for an empty cart', async () => {
    const { mock } = setup(() => ({ status: 201, data: order() }), cart());
    restore = mock.restore;
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
  });

  it('blocks the order while the cart has stock issues', async () => {
    const short = cartItem({ quantity: 5, stock: 2, issue: 'INSUFFICIENT_STOCK' });
    const { mock } = setup(() => ({ status: 201, data: order() }), cart([short]));
    restore = mock.restore;

    expect(await screen.findByRole('link', { name: 'Update the cart' })).toBeInTheDocument();
    expect(placeOrder()).toBeDisabled();
  });
});

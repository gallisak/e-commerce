import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InternalAxiosRequestConfig } from 'axios';
import { CartButton } from '@/features/cart/components/cart-button';
import type { Cart } from '@/lib/api/types';
import { cart, cartItem } from '@/test/fixtures';
import { errorBody, mockApi, type MockReply } from '@/test/http';
import { authValue, customer, renderRoutes } from '@/test/render';
import { setCartQuantity } from '../cart-math';
import { CartPage } from './cart-page';

const book = cartItem({ quantity: 2 });
const phone = cartItem({
  productId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Nova X Smartphone',
  price: 1_899_900,
  stock: 3,
});

const routes = [
  {
    path: '/cart',
    element: (
      <>
        <CartButton />
        <CartPage />
      </>
    ),
  },
  { path: '/checkout', element: <h1>Checkout route</h1> },
];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

function setup(
  initial: Cart,
  onWrite?: (
    config: InternalAxiosRequestConfig,
    server: { cart: Cart },
  ) => Promise<MockReply> | MockReply,
) {
  const server = { cart: initial };
  const mock = mockApi(async (config) => {
    if (config.method === 'get') return { status: 200, data: server.cart };
    if (onWrite) return onWrite(config, server);
    return { status: 200, data: server.cart };
  });
  renderRoutes(routes, { path: '/cart', auth: authValue({ user: customer }) });
  const writes = () => mock.calls.filter((call) => call.method !== 'get');
  return { mock, server, writes };
}

const line = (name: string) => screen.getByRole('listitem', { name });
const quantityOf = (name: string) => within(line(name)).getByRole('textbox', { name: 'Quantity' });

describe('CartPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('shows the lines, totals and header badge', async () => {
    restore = setup(cart([book, phone])).mock.restore;

    expect(await screen.findByRole('listitem', { name: 'Clean Code' })).toBeInTheDocument();
    expect(within(line('Clean Code')).getByLabelText('Line total')).toHaveTextContent('₴1,198.00');
    expect(screen.getByLabelText('Cart total')).toHaveTextContent('₴20,197.00');
    expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toHaveAttribute('href', '/cart');
  });

  it('shows an empty state', async () => {
    restore = setup(cart()).mock.restore;
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the catalog' })).toHaveAttribute('href', '/');
  });

  it('updates the quantity optimistically before the server answers', async () => {
    const gate = deferred();
    const { mock, writes } = setup(cart([book, phone]), async (config, server) => {
      await gate.promise;
      const { quantity } = JSON.parse(config.data);
      server.cart = setCartQuantity(server.cart, book.productId, quantity);
      return { status: 200, data: server.cart };
    });
    restore = mock.restore;

    await screen.findByRole('listitem', { name: 'Clean Code' });
    await userEvent.click(
      within(line('Clean Code')).getByRole('button', { name: 'Increase quantity' }),
    );

    expect(quantityOf('Clean Code')).toHaveValue('3');
    expect(screen.getByLabelText('Cart total')).toHaveTextContent('₴20,796.00');
    expect(screen.getByRole('link', { name: 'Cart, 4 items' })).toBeInTheDocument();
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'patch', url: `/cart/items/${book.productId}` });

    gate.resolve();
    await waitFor(() => expect(mock.calls.at(-1)?.method).toBe('patch'));
    expect(quantityOf('Clean Code')).toHaveValue('3');
  });

  it('sends rapid changes one after another', async () => {
    const gates = [deferred(), deferred()];
    const { mock, writes } = setup(cart([book]), async (config, server) => {
      const { quantity } = JSON.parse(config.data);
      await gates[writes().length - 1].promise;
      server.cart = setCartQuantity(server.cart, book.productId, quantity);
      return { status: 200, data: server.cart };
    });
    restore = mock.restore;

    await screen.findByRole('listitem', { name: 'Clean Code' });
    const increase = within(line('Clean Code')).getByRole('button', { name: 'Increase quantity' });
    await userEvent.click(increase);
    await userEvent.click(increase);
    expect(quantityOf('Clean Code')).toHaveValue('4');
    await waitFor(() => expect(writes()).toHaveLength(1));

    gates[0].resolve();
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes().map((call) => JSON.parse(call.data).quantity)).toEqual([3, 4]);
    expect(quantityOf('Clean Code')).toHaveValue('4');

    gates[1].resolve();
    await waitFor(() => expect(screen.getByLabelText('Cart total')).toHaveTextContent('₴2,396.00'));
  });

  it('rolls back and explains when the server rejects a change', async () => {
    const { mock } = setup(cart([phone]), () => ({
      status: 409,
      data: errorBody(409, 'Only 3 unit(s) of "Nova X Smartphone" available', { available: 3 }),
    }));
    restore = mock.restore;

    const input = await screen.findByRole('textbox', { name: 'Quantity' });
    await userEvent.clear(input);
    await userEvent.type(input, '3{Enter}');

    expect(
      await screen.findByText('Only 3 unit(s) of "Nova X Smartphone" available'),
    ).toBeInTheDocument();
    await waitFor(() => expect(quantityOf('Nova X Smartphone')).toHaveValue('1'));
    expect(screen.getByLabelText('Cart total')).toHaveTextContent('₴18,999.00');
  });

  it('removes a line instantly and can undo it', async () => {
    const { mock, writes } = setup(cart([book, phone]), (config, server) => {
      if (config.method === 'delete') {
        server.cart = cart([phone]);
      } else {
        server.cart = cart([phone, book]);
      }
      return { status: 200, data: server.cart };
    });
    restore = mock.restore;

    await screen.findByRole('listitem', { name: 'Clean Code' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove Clean Code' }));
    expect(screen.queryByRole('listitem', { name: 'Clean Code' })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('listitem', { name: 'Clean Code' })).toBeInTheDocument();
    const undo = writes().at(-1);
    expect(undo).toMatchObject({ method: 'post', url: '/cart/items' });
    expect(JSON.parse(undo?.data)).toEqual({ productId: book.productId, quantity: 2 });
  });

  it('offers Undo for every removed line, even when removed quickly', async () => {
    const gate = deferred();
    const { mock } = setup(cart([book, phone]), async (config, server) => {
      await gate.promise;
      const productId = config.url?.split('/').pop();
      server.cart = cart(server.cart.items.filter((item) => item.productId !== productId));
      return { status: 200, data: server.cart };
    });
    restore = mock.restore;

    await screen.findByRole('listitem', { name: 'Clean Code' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove Clean Code' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Nova X Smartphone' }));
    gate.resolve();

    expect(await screen.findByText('Removed “Clean Code”')).toBeInTheDocument();
    expect(await screen.findByText('Removed “Nova X Smartphone”')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2);
  });

  it('waits for pending changes before allowing checkout', async () => {
    const gate = deferred();
    const { mock } = setup(cart([book]), async (config, server) => {
      await gate.promise;
      server.cart = setCartQuantity(server.cart, book.productId, JSON.parse(config.data).quantity);
      return { status: 200, data: server.cart };
    });
    restore = mock.restore;

    await screen.findByRole('listitem', { name: 'Clean Code' });
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    expect(screen.getByRole('button', { name: 'Saving the cart…' })).toBeDisabled();
    gate.resolve();
    expect(await screen.findByRole('button', { name: 'Proceed to checkout' })).toBeEnabled();
  });

  it('blocks checkout until stock issues are fixed', async () => {
    const short = {
      ...phone,
      quantity: 5,
      lineTotal: 5 * phone.price,
      issue: 'INSUFFICIENT_STOCK' as const,
    };
    const { mock, writes } = setup(cart([short]), (config, server) => {
      server.cart = setCartQuantity(server.cart, phone.productId, JSON.parse(config.data).quantity);
      return { status: 200, data: server.cart };
    });
    restore = mock.restore;

    expect(await screen.findByText('Only 3 available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proceed to checkout' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Set quantity to 3' }));
    expect(JSON.parse(writes()[0].data)).toEqual({ quantity: 3 });
    expect(screen.getByRole('button', { name: 'Proceed to checkout' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Proceed to checkout' }));
    expect(await screen.findByRole('heading', { name: 'Checkout route' })).toBeInTheDocument();
  });

  it('flags out of stock lines', async () => {
    const gone = { ...book, stock: 0, issue: 'OUT_OF_STOCK' as const };
    restore = setup(cart([gone])).mock.restore;

    expect(
      await screen.findByText('This product is out of stock. Remove it to place the order.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toBeDisabled();
  });

  it('clears the cart after confirmation', async () => {
    const { mock, writes } = setup(cart([book, phone]), (_config, server) => {
      server.cart = cart();
      return { status: 200, data: server.cart };
    });
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Clear cart' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clear cart' }));

    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
    expect(writes()[0]).toMatchObject({ method: 'delete', url: '/cart' });
  });

  it('shows a retryable error when the cart cannot be loaded', async () => {
    let fail = true;
    const mock = mockApi(() =>
      fail ? { status: 500, data: errorBody(500, 'boom') } : { status: 200, data: cart([book]) },
    );
    restore = mock.restore;
    renderRoutes(routes, { path: '/cart', auth: authValue({ user: customer }) });

    expect(await screen.findByText('Could not load your cart')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('listitem', { name: 'Clean Code' })).toBeInTheDocument();
  });
});

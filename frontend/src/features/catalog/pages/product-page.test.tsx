import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartButton } from '@/features/cart/components/cart-button';
import { cart, cartItem, product } from '@/test/fixtures';
import { errorBody, mockApi } from '@/test/http';
import { authValue, customer, renderRoutes } from '@/test/render';
import { ProductPage } from './product-page';

const routes = [{ path: '/products/:productId', element: <ProductPage /> }];
const item = product({
  description: 'Line one\nLine two',
  imageUrl: 'https://picsum.photos/seed/x/600/600',
});

describe('ProductPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('shows the product details with breadcrumbs', async () => {
    restore = mockApi(() => ({ status: 200, data: item })).restore;
    renderRoutes(routes, { path: `/products/${item.id}` });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Clean Code' }),
    ).toBeInTheDocument();
    expect(screen.getByText('₴599.00')).toBeInTheDocument();
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Clean Code' })).toHaveAttribute('src', item.imageUrl);
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Catalog');
    expect(screen.getAllByRole('link', { name: 'Books' })[0]).toHaveAttribute(
      'href',
      '/?category=books',
    );
    expect(document.title).toBe('Clean Code · Mini Marketplace');
  });

  it('shows a not found state for a deleted product', async () => {
    restore = mockApi(() => ({ status: 404, data: errorBody(404, 'Product not found') })).restore;
    renderRoutes(routes, { path: `/products/${item.id}` });

    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });

  it('does not call the API for a malformed id', async () => {
    const mock = mockApi(() => ({ status: 200, data: item }));
    restore = mock.restore;
    renderRoutes(routes, { path: '/products/not-a-uuid' });

    expect(await screen.findByText('Product not found')).toBeInTheDocument();
    expect(mock.calls).toHaveLength(0);
  });

  it('offers a retry when the server fails', async () => {
    restore = mockApi(() => ({ status: 503, data: errorBody(503, 'unavailable') })).restore;
    renderRoutes(routes, { path: `/products/${item.id}` });

    expect(
      await screen.findByText('Could not load the product', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('ProductPage add to cart', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  function setup(initialCart = cart(), stock = item.stock) {
    let serverCart = initialCart;
    const mock = mockApi((config) => {
      if (config.url === '/cart') return { status: 200, data: serverCart };
      if (config.url === '/cart/items') {
        const { quantity } = JSON.parse(config.data);
        serverCart = cart([cartItem({ stock, quantity })]);
        return { status: 200, data: serverCart };
      }
      return { status: 200, data: { ...item, stock } };
    });
    restore = mock.restore;
    renderRoutes(
      [
        {
          path: '/products/:productId',
          element: [<CartButton key="cart" />, <ProductPage key="page" />],
        },
      ],
      { path: `/products/${item.id}`, auth: authValue({ user: customer }) },
    );
    return mock;
  }

  it('asks guests to log in and come back', async () => {
    restore = mockApi(() => ({ status: 200, data: item })).restore;
    renderRoutes(routes, { path: `/products/${item.id}` });

    expect(await screen.findByRole('link', { name: 'Log in to buy' })).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent(`/products/${item.id}`)}`,
    );
  });

  it('adds the chosen quantity and updates the badge at once', async () => {
    const mock = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(screen.getByRole('link', { name: 'Cart, 2 items' })).toBeInTheDocument();
    expect(screen.getByText('2 already in your cart.')).toBeInTheDocument();
    expect(await screen.findByText('Added “Clean Code” to the cart')).toBeInTheDocument();
    const add = mock.calls.find((call) => call.url === '/cart/items');
    expect(JSON.parse(add?.data)).toEqual({ productId: item.id, quantity: 2 });
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('1');
  });

  it('does not offer more than the remaining stock', async () => {
    setup(cart([cartItem({ stock: 3, quantity: 3 })]), 3);

    expect(
      await screen.findByText('All available units are already in your cart.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
  });

  it('disables buying an out of stock product', async () => {
    setup(cart(), 0);
    expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled();
  });
});

import { screen } from '@testing-library/react';
import { product } from '@/test/fixtures';
import { errorBody, mockApi } from '@/test/http';
import { renderRoutes } from '@/test/render';
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

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InternalAxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router';
import { categories, page, product } from '@/test/fixtures';
import { errorBody, mockApi, type MockReply } from '@/test/http';
import { renderRoutes } from '@/test/render';
import { CatalogPage } from './catalog-page';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const routes = [
  {
    path: '/',
    element: (
      <>
        <CatalogPage />
        <LocationProbe />
      </>
    ),
  },
];

const products = [
  product(),
  product({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Refactoring', stock: 0 }),
  product({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Nova X Smartphone', stock: 3 }),
];

function setup(
  path = '/',
  onProducts: (config: InternalAxiosRequestConfig) => MockReply = () => ({
    status: 200,
    data: page(products),
  }),
) {
  const mock = mockApi((config) =>
    config.url === '/categories' ? { status: 200, data: categories } : onProducts(config),
  );
  const view = renderRoutes(routes, { path });
  const productRequests = () => mock.calls.filter((call) => call.url === '/products');
  return { ...view, mock, productRequests };
}

const currentSearch = () => screen.getByTestId('location').textContent;

describe('CatalogPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('shows products with prices and stock status', async () => {
    const { mock } = setup();
    restore = mock.restore;

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByRole('link', { name: 'Clean Code' })).toHaveAttribute(
      'href',
      `/products/${products[0].id}`,
    );
    expect(within(cards[0]).getByText('₴599.00')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Out of stock')).toBeInTheDocument();
    expect(within(cards[2]).getByText('Only 3 left')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–3 of 3 products')).toBeInTheDocument();
  });

  it('turns URL filters into API parameters, converting prices to kopecks', async () => {
    const { mock, productRequests } = setup(
      '/?q=code&category=books&minPrice=100&maxPrice=700&sort=price_asc&page=2',
      () => ({ status: 200, data: page(products, { page: 2, total: 15, totalPages: 2 }) }),
    );
    restore = mock.restore;

    await screen.findByText('Showing 13–15 of 15 products');
    expect(productRequests().at(-1)?.params).toEqual({
      page: 2,
      search: 'code',
      categoryId: categories[0].id,
      minPrice: 10_000,
      maxPrice: 70_000,
      sort: 'price_asc',
      limit: 12,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Books' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter “code”' })).toBeInTheDocument();
  });

  it('updates the URL when a category is picked and resets the page', async () => {
    const { mock } = setup('/?page=2', () => ({
      status: 200,
      data: page(products, { page: 2, total: 15, totalPages: 2 }),
    }));
    restore = mock.restore;

    const categoryGroup = await screen.findByRole('group', { name: 'Category' });
    await userEvent.click(
      await within(categoryGroup).findByRole('button', { name: /Electronics/ }),
    );

    expect(currentSearch()).toBe('?category=electronics');
    expect(within(categoryGroup).getByRole('button', { name: /Electronics/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Remove filter Electronics' })).toBeInTheDocument();
  });

  it('debounces search input into the URL', async () => {
    const { mock, productRequests } = setup();
    restore = mock.restore;
    await screen.findByText('Showing 1–3 of 3 products');
    const before = productRequests().length;

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), 'smart');

    await waitFor(() => expect(currentSearch()).toBe('?q=smart'));
    await waitFor(() => expect(productRequests().at(-1)?.params.search).toBe('smart'));
    expect(productRequests().length - before).toBe(1);
  });

  it('validates the price range before applying it', async () => {
    const { mock } = setup();
    restore = mock.restore;
    await screen.findByText('Showing 1–3 of 3 products');

    await userEvent.type(screen.getByLabelText('Minimum price'), '500');
    await userEvent.type(screen.getByLabelText('Maximum price'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Apply price' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Minimum price cannot be greater than maximum',
    );
    expect(currentSearch()).toBe('');

    await userEvent.clear(screen.getByLabelText('Maximum price'));
    await userEvent.type(screen.getByLabelText('Maximum price'), '900');
    await userEvent.click(screen.getByRole('button', { name: 'Apply price' }));
    expect(currentSearch()).toBe('?minPrice=500&maxPrice=900');
  });

  it('offers to clear filters when nothing matches', async () => {
    const { mock } = setup('/?q=zzz&minPrice=1', () => ({ status: 200, data: page([]) }));
    restore = mock.restore;

    expect(await screen.findByText('No products match your filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(currentSearch()).toBe('');
  });

  it('explains when a page is out of range', async () => {
    const { mock } = setup('/?page=9', () => ({
      status: 200,
      data: page([], { page: 9, total: 3, totalPages: 1 }),
    }));
    restore = mock.restore;

    expect(await screen.findByText('This page is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the first page' })).toHaveAttribute('href', '/');
  });

  it('reports an unknown category without requesting products', async () => {
    const { mock, productRequests } = setup('/?category=toys');
    restore = mock.restore;

    expect(await screen.findByText('Category not found')).toBeInTheDocument();
    expect(productRequests()).toHaveLength(0);
  });

  it('does not drop the category filter when categories fail to load', async () => {
    const mock = mockApi((config) =>
      config.url === '/categories'
        ? { status: 500, data: errorBody(500, 'boom') }
        : { status: 200, data: page(products) },
    );
    restore = mock.restore;
    renderRoutes(routes, { path: '/?category=books' });

    expect(await screen.findByText('Could not load categories')).toBeInTheDocument();
    expect(mock.calls.filter((call) => call.url === '/products')).toHaveLength(0);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows the error with a request id and retries on demand', async () => {
    let fail = true;
    const { mock } = setup('/', () =>
      fail
        ? { status: 500, data: errorBody(500, 'Internal server error') }
        : { status: 200, data: page(products) },
    );
    restore = mock.restore;

    expect(await screen.findByText('Could not load products')).toBeInTheDocument();
    expect(screen.getByText('req-test-0001')).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Showing 1–3 of 3 products')).toBeInTheDocument();
  });

  it('links pages with the current filters preserved', async () => {
    const { mock } = setup('/?category=books', () => ({
      status: 200,
      data: page(products, { total: 30, totalPages: 3 }),
    }));
    restore = mock.restore;

    const nav = await screen.findByRole('navigation', { name: 'Catalog pages' });
    expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'href',
      '/?category=books&page=2',
    );
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

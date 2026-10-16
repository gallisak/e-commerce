import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { categories, page, product } from '@/test/fixtures';
import { errorBody, mockApi, type MockHandler } from '@/test/http';
import { admin, authValue, renderRoutes } from '@/test/render';
import { AdminProductsPage } from './admin-products-page';

function SearchProbe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const routes = [
  {
    path: '/admin/products',
    element: [<AdminProductsPage key="page" />, <SearchProbe key="probe" />],
  },
];

const items = [
  product(),
  product({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Refactoring', stock: 0 }),
];

function setup(handler: MockHandler, path = '/admin/products') {
  const mock = mockApi((config) =>
    config.url === '/categories' ? { status: 200, data: categories } : handler(config),
  );
  renderRoutes(routes, { path, auth: authValue({ user: admin }) });
  const listCalls = () =>
    mock.calls.filter((call) => call.method === 'get' && call.url === '/products');
  return { mock, listCalls };
}

describe('AdminProductsPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('lists products with price, stock and actions', async () => {
    restore = setup(() => ({ status: 200, data: page(items) })).mock.restore;

    const table = await screen.findByRole('table', { name: 'Products' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole('link', { name: 'Clean Code' })).toHaveAttribute(
      'href',
      `/admin/products/${items[0].id}/edit`,
    );
    expect(rows[1]).toHaveTextContent('₴599.00');
    expect(within(rows[2]).getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('2 products')).toBeInTheDocument();
  });

  it('reads filters from the URL and sends them to the API', async () => {
    const { mock, listCalls } = setup(
      () => ({ status: 200, data: page(items, { page: 2, total: 22, totalPages: 2 }) }),
      `/admin/products?q=code&category=${categories[0].id}&page=2`,
    );
    restore = mock.restore;

    await screen.findByRole('table', { name: 'Products' });
    expect(listCalls().at(-1)?.params).toEqual({
      page: 2,
      search: 'code',
      categoryId: categories[0].id,
      limit: 20,
    });
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toHaveTextContent('Books');
    const nav = screen.getByRole('navigation', { name: 'Product pages' });
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'href',
      `/admin/products?q=code&category=${categories[0].id}`,
    );
  });

  it('ignores a malformed category id', async () => {
    const { mock, listCalls } = setup(
      () => ({ status: 200, data: page(items) }),
      '/admin/products?category=books',
    );
    restore = mock.restore;
    await screen.findByRole('table', { name: 'Products' });
    expect(listCalls()[0].params).toEqual({ page: 1, limit: 20 });
  });

  it('resets the page when the search changes', async () => {
    const { mock, listCalls } = setup(
      () => ({ status: 200, data: page(items) }),
      '/admin/products?page=3',
    );
    restore = mock.restore;
    await screen.findByRole('table', { name: 'Products' });

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search products' }),
      'clean{Enter}',
    );

    expect(screen.getByTestId('search')).toHaveTextContent('?q=clean');
    await waitFor(() =>
      expect(listCalls().at(-1)?.params).toMatchObject({ page: 1, search: 'clean' }),
    );
  });

  it('deletes a product after confirmation and reloads the list', async () => {
    let current = items;
    const { mock, listCalls } = setup((config) => {
      if (config.method === 'delete') {
        current = items.slice(1);
        return { status: 204 };
      }
      return { status: 200, data: page(current) };
    });
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Clean Code' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete “Clean Code”?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('“Clean Code” deleted')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Clean Code' })).not.toBeInTheDocument(),
    );
    expect(mock.calls.find((call) => call.method === 'delete')?.url).toBe(
      `/products/${items[0].id}`,
    );
    expect(listCalls().length).toBeGreaterThan(1);
  });

  it('shows empty states', async () => {
    restore = setup(() => ({ status: 200, data: page([]) }), '/admin/products?q=zzz').mock.restore;
    expect(await screen.findByText('No products match the filters')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/admin/products',
    );
  });

  it('links back to the first page when a page is past the end', async () => {
    restore = setup(
      () => ({ status: 200, data: page([], { page: 3, total: 40, totalPages: 2 }) }),
      '/admin/products?q=code&page=3',
    ).mock.restore;
    expect(await screen.findByText('This page is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the first page' })).toHaveAttribute(
      'href',
      '/admin/products?q=code',
    );
  });

  it('keeps the category when a search is submitted', async () => {
    const { mock } = setup(
      () => ({ status: 200, data: page(items) }),
      `/admin/products?category=${categories[0].id}&page=2`,
    );
    restore = mock.restore;
    await screen.findByRole('table', { name: 'Products' });

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search products' }),
      'clean{Enter}',
    );

    expect(screen.getByTestId('search')).toHaveTextContent(`?category=${categories[0].id}&q=clean`);
  });

  it('offers to create the first product', async () => {
    restore = setup(() => ({ status: 200, data: page([]) })).mock.restore;
    expect(await screen.findByRole('link', { name: 'Create the first product' })).toHaveAttribute(
      'href',
      '/admin/products/new',
    );
  });

  it('shows an error with retry', async () => {
    restore = setup(() => ({ status: 500, data: errorBody(500, 'boom') })).mock.restore;
    expect(await screen.findByText('Could not load products')).toBeInTheDocument();
  });
});

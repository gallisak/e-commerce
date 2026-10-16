import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InternalAxiosRequestConfig } from 'axios';
import type { Category } from '@/lib/api/types';
import { categories } from '@/test/fixtures';
import { errorBody, mockApi, type MockReply } from '@/test/http';
import { admin, authValue, renderRoutes } from '@/test/render';
import { AdminCategoriesPage } from './admin-categories-page';

const routes = [{ path: '/admin/categories', element: <AdminCategoriesPage /> }];

function setup(
  onWrite: (config: InternalAxiosRequestConfig, state: { list: Category[] }) => MockReply,
) {
  const state = { list: [...categories] };
  const mock = mockApi((config) =>
    config.method === 'get' ? { status: 200, data: state.list } : onWrite(config, state),
  );
  renderRoutes(routes, { path: '/admin/categories', auth: authValue({ user: admin }) });
  const writes = () => mock.calls.filter((call) => call.method !== 'get');
  return { mock, writes };
}

const garden: Category = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Garden',
  slug: 'garden',
  productsCount: 0,
};

const row = (name: string) =>
  within(screen.getByRole('list', { name: 'Categories' })).getByRole('listitem', { name });

describe('AdminCategoriesPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('lists categories with slug and product count', async () => {
    restore = setup(() => ({ status: 200 })).mock.restore;
    await screen.findByRole('list', { name: 'Categories' });
    expect(row('Books')).toHaveTextContent('/books · 2 products');
    expect(row('Electronics')).toHaveTextContent('/electronics · 1 product');
  });

  it('creates a category with a generated slug and clears the form', async () => {
    const { mock, writes } = setup((_config, state) => {
      state.list = [...state.list, garden];
      return { status: 201, data: garden };
    });
    restore = mock.restore;
    await screen.findByRole('list', { name: 'Categories' });

    await userEvent.type(screen.getByLabelText('Name'), ' Garden ');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Category “Garden” created')).toBeInTheDocument();
    expect(JSON.parse(writes()[0].data)).toEqual({ name: 'Garden' });
    await waitFor(() => expect(row('Garden')).toHaveTextContent('/garden · 0 products'));
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('validates the slug on the client', async () => {
    const { mock, writes } = setup(() => ({ status: 201 }));
    restore = mock.restore;
    await screen.findByRole('list', { name: 'Categories' });

    await userEvent.type(screen.getByLabelText('Name'), 'Garden');
    await userEvent.type(screen.getByLabelText('Slug'), 'Garden Tools');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(
      await screen.findByText('Use lowercase latin letters, digits and hyphens'),
    ).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('shows a duplicate error from the server', async () => {
    restore = setup(() => ({
      status: 409,
      data: errorBody(409, 'Category with this name or slug already exists'),
    })).mock.restore;
    await screen.findByRole('list', { name: 'Categories' });

    await userEvent.type(screen.getByLabelText('Name'), 'Books');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));

    expect(
      await screen.findByText('Category with this name or slug already exists'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Books');
  });

  it('renames a category and keeps its slug', async () => {
    const { mock, writes } = setup((_config, state) => {
      const renamed = { ...state.list[0], name: 'Books & Media' };
      state.list = [renamed, ...state.list.slice(1)];
      return { status: 200, data: renamed };
    });
    restore = mock.restore;
    await screen.findByRole('list', { name: 'Categories' });

    await userEvent.click(within(row('Books')).getByRole('button', { name: 'Edit Books' }));
    const name = within(row('Books')).getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Books & Media');
    await userEvent.click(within(row('Books')).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Category “Books & Media” saved')).toBeInTheDocument();
    expect(writes()[0]).toMatchObject({ method: 'patch', url: `/categories/${categories[0].id}` });
    expect(JSON.parse(writes()[0].data)).toEqual({ name: 'Books & Media', slug: 'books' });
    await waitFor(() => expect(row('Books & Media')).toHaveTextContent('/books'));
  });

  it('can cancel editing', async () => {
    restore = setup(() => ({ status: 200 })).mock.restore;
    await screen.findByRole('list', { name: 'Categories' });
    await userEvent.click(within(row('Books')).getByRole('button', { name: 'Edit Books' }));
    await userEvent.click(within(row('Books')).getByRole('button', { name: 'Cancel' }));
    expect(within(row('Books')).queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('keeps a category with products and explains why', async () => {
    const { mock } = setup(() => ({
      status: 409,
      data: errorBody(409, 'Category has products and cannot be deleted'),
    }));
    restore = mock.restore;
    await screen.findByRole('list', { name: 'Categories' });

    await userEvent.click(within(row('Books')).getByRole('button', { name: 'Delete Books' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('This category still has products');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('Category has products and cannot be deleted'),
    ).toBeInTheDocument();
    const stillOpen = screen.getByRole('alertdialog');
    await userEvent.click(within(stillOpen).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(row('Books')).toBeInTheDocument();
  });

  it('deletes an empty category', async () => {
    const { mock } = setup((_config, state) => {
      state.list = state.list.slice(0, 1);
      return { status: 204 };
    });
    restore = mock.restore;
    await screen.findByRole('list', { name: 'Categories' });

    await userEvent.click(
      within(row('Electronics')).getByRole('button', { name: 'Delete Electronics' }),
    );
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByText('Category “Electronics” deleted')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Categories' })).queryByRole('listitem', {
          name: 'Electronics',
        }),
      ).not.toBeInTheDocument(),
    );
  });
});

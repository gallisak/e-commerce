import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InternalAxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router';
import { categories, product } from '@/test/fixtures';
import { errorBody, mockApi, type MockReply } from '@/test/http';
import { admin, authValue, renderRoutes } from '@/test/render';
import { EditProductPage, NewProductPage } from './product-editor-page';

function PathProbe() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

const routes = [
  { path: '/admin/products/new', element: <NewProductPage /> },
  {
    path: '/admin/products/:productId/edit',
    element: [<EditProductPage key="page" />, <PathProbe key="probe" />],
  },
  { path: '/admin/products', element: <PathProbe /> },
];

const existing = product({ imageUrl: '/uploads/products/old.png' });

function setup(path: string, onWrite: (config: InternalAxiosRequestConfig) => MockReply) {
  const mock = mockApi((config) => {
    if (config.method === 'get' && config.url === '/categories')
      return { status: 200, data: categories };
    if (config.method === 'get') return { status: 200, data: existing };
    return onWrite(config);
  });
  renderRoutes(routes, { path, auth: authValue({ user: admin }) });
  const writes = () => mock.calls.filter((call) => call.method !== 'get');
  return { mock, writes };
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText('Name'), 'Garden Hose');
  await userEvent.type(screen.getByLabelText('Description'), 'Line one{Enter}Line two');
  await userEvent.type(screen.getByLabelText('Price, ₴'), '1299,5');
  await userEvent.type(screen.getByLabelText('Stock'), '7');
  await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Electronics' }));
}

const png = () => new File(['png'], 'hose.png', { type: 'image/png' });

describe('NewProductPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('validates the form before sending anything', async () => {
    const { mock, writes } = setup('/admin/products/new', () => ({ status: 201 }));
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Create product' }));

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Price is required')).toBeInTheDocument();
    expect(screen.getByText('Stock is required')).toBeInTheDocument();
    expect(screen.getAllByText('Choose a category').length).toBeGreaterThan(0);
    expect(screen.getByText('Choose an image file')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('creates the product and uploads the chosen image', async () => {
    const { mock, writes } = setup('/admin/products/new', (config) =>
      config.url === '/products'
        ? { status: 201, data: product({ id: existing.id, name: 'Garden Hose' }) }
        : { status: 200, data: product({ name: 'Garden Hose' }) },
    );
    restore = mock.restore;

    await screen.findByLabelText('Name');
    await fillRequired();
    await userEvent.upload(screen.getByLabelText('Image file'), png());
    expect(screen.getByText('hose.png')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Image preview' })).toHaveAttribute(
      'src',
      'blob:preview',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    expect(await screen.findByTestId('path')).toHaveTextContent('/admin/products');
    const [create, upload] = writes();
    expect(JSON.parse(create.data)).toEqual({
      name: 'Garden Hose',
      description: 'Line one\nLine two',
      price: 129_950,
      stock: 7,
      categoryId: categories[1].id,
    });
    expect(upload.url).toBe(`/products/${existing.id}/image`);
    expect((upload.data as FormData).get('file')).toBeInstanceOf(File);
    expect(await screen.findByText('“Garden Hose” created')).toBeInTheDocument();
  });

  it('sends a linked image URL with the product', async () => {
    const { mock, writes } = setup('/admin/products/new', () => ({
      status: 201,
      data: product({ name: 'Garden Hose' }),
    }));
    restore = mock.restore;

    await screen.findByLabelText('Name');
    await fillRequired();
    await userEvent.click(screen.getByRole('tab', { name: 'Link' }));
    await userEvent.type(screen.getByLabelText('Image URL'), 'https://picsum.photos/seed/hose/600');
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    await screen.findByTestId('path');
    expect(writes()).toHaveLength(1);
    expect(JSON.parse(writes()[0].data).imageUrl).toBe('https://picsum.photos/seed/hose/600');
  });

  it('opens the saved product for editing when the upload fails', async () => {
    const { mock } = setup('/admin/products/new', (config) =>
      config.url === '/products'
        ? { status: 201, data: product({ name: 'Garden Hose' }) }
        : { status: 400, data: errorBody(400, 'Only JPEG, PNG and WebP images are allowed') },
    );
    restore = mock.restore;

    await screen.findByLabelText('Name');
    await fillRequired();
    await userEvent.upload(screen.getByLabelText('Image file'), png());
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    expect(
      await screen.findByText(
        '“Garden Hose” was saved, but the image was not uploaded: Only JPEG, PNG and WebP images are allowed',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByTestId('path')).toHaveTextContent(
      `/admin/products/${existing.id}/edit`,
    );
  });

  it('maps server validation errors to fields', async () => {
    const { mock } = setup('/admin/products/new', () => ({
      status: 400,
      data: errorBody(400, ['name must be shorter than or equal to 200 characters']),
    }));
    restore = mock.restore;

    await screen.findByLabelText('Name');
    await fillRequired();
    await userEvent.click(screen.getByRole('tab', { name: 'No image' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    expect(
      await screen.findByText('Name must be shorter than or equal to 200 characters'),
    ).toBeInTheDocument();
  });
});

describe('EditProductPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it('prefills the form and keeps the uploaded image', async () => {
    const { mock, writes } = setup(`/admin/products/${existing.id}/edit`, () => ({
      status: 200,
      data: existing,
    }));
    restore = mock.restore;

    expect(await screen.findByLabelText('Price, ₴')).toHaveValue('599.00');
    expect(screen.getByLabelText('Stock')).toHaveValue('12');
    expect(screen.getByRole('img', { name: 'Image preview' })).toHaveAttribute(
      'src',
      existing.imageUrl,
    );
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Books');

    await userEvent.clear(screen.getByLabelText('Price, ₴'));
    await userEvent.type(screen.getByLabelText('Price, ₴'), '650');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: 'patch', url: `/products/${existing.id}` });
    const body = JSON.parse(writes()[0].data);
    expect(body.price).toBe(65_000);
    expect(body).not.toHaveProperty('imageUrl');
  });

  it('removes the image when "No image" is chosen', async () => {
    const { mock, writes } = setup(`/admin/products/${existing.id}/edit`, () => ({
      status: 200,
      data: existing,
    }));
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('tab', { name: 'No image' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(JSON.parse(writes()[0].data).imageUrl).toBeNull();
  });

  it('shows not found for a deleted product', async () => {
    const mock = mockApi(() => ({ status: 404, data: errorBody(404, 'Product not found') }));
    restore = mock.restore;
    renderRoutes(routes, {
      path: `/admin/products/${existing.id}/edit`,
      auth: authValue({ user: admin }),
    });
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });
});

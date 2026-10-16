import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { catalogKeys } from '@/features/catalog/api';
import { categories, product } from '@/test/fixtures';
import { errorBody } from '@/test/http';
import { admin } from '@/test/render';
import { storyParameters } from '@/test/storybook';
import { ProductForm } from './product-form';

const meta = {
  tags: ['!autodocs'],
  title: 'Forms/ProductForm',
  component: ProductForm,
  parameters: storyParameters({
    user: admin,
    queryData: [[catalogKeys.categories(), categories]],
    api: (config) =>
      config.method === 'post'
        ? { status: 201, data: product({ name: JSON.parse(config.data).name }) }
        : { status: 200, data: product() },
  }),
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProductForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = {
  args: {
    product: product({
      imageUrl: 'https://picsum.photos/seed/clean-code/600/600',
      description: 'Robert C. Martin.\nA classic on code quality.',
    }),
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Price, ₴'), '12.345');
    await userEvent.click(canvas.getByRole('button', { name: 'Create product' }));
    await expect(await canvas.findByText('Name must be at least 2 characters')).toBeVisible();
    await expect(canvas.getByText('Enter a price like 599 or 599.99')).toBeVisible();
    await expect(canvas.getByText('Stock is required')).toBeVisible();
    await expect(canvas.getByText('Choose an image file')).toBeVisible();
  },
};

export const LinkedImage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Link' }));
    await userEvent.type(
      canvas.getByLabelText('Image URL'),
      'https://picsum.photos/seed/hose/600/600',
    );
    await waitFor(() =>
      expect(canvas.getByRole('img', { name: 'Image preview' })).toHaveAttribute(
        'src',
        'https://picsum.photos/seed/hose/600/600',
      ),
    );
  },
};

export const ServerError: Story = {
  args: { product: product() },
  parameters: storyParameters({
    user: admin,
    queryData: [[catalogKeys.categories(), categories]],
    api: () => ({ status: 400, data: errorBody(400, ['Category does not exist']) }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'No image' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }));
    await expect(await canvas.findByText('Category does not exist')).toBeVisible();
  },
};

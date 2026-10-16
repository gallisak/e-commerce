import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ApiError } from '@/lib/api/errors';
import { CategoryForm } from './category-form';

const meta = {
  title: 'Forms/CategoryForm',
  component: CategoryForm,
  args: {
    idPrefix: 'story-category',
    submitLabel: 'Add category',
    slugHint: 'Used in catalog links. Leave empty to generate it.',
    onSubmit: fn(async () => undefined),
  },
} satisfies Meta<typeof CategoryForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Garden');
    await userEvent.click(canvas.getByRole('button', { name: 'Add category' }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'Garden', slug: '' });
    await expect(canvas.getByLabelText('Name')).toHaveValue('');
  },
};

export const Edit: Story = {
  args: {
    defaultValues: { name: 'Books', slug: 'books' },
    submitLabel: 'Save',
    slugHint: 'Changing the slug breaks old catalog links.',
    onCancel: fn(),
  },
};

export const InvalidSlug: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Garden');
    await userEvent.type(canvas.getByLabelText('Slug'), 'Garden Tools');
    await userEvent.click(canvas.getByRole('button', { name: 'Add category' }));
    await expect(
      await canvas.findByText('Use lowercase latin letters, digits and hyphens'),
    ).toBeVisible();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const Duplicate: Story = {
  args: {
    onSubmit: fn(async () => {
      throw new ApiError({
        status: 409,
        messages: ['Category with this name or slug already exists'],
      });
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Books');
    await userEvent.click(canvas.getByRole('button', { name: 'Add category' }));
    await expect(
      await canvas.findByText('Category with this name or slug already exists'),
    ).toBeVisible();
  },
};

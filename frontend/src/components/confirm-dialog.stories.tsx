import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './ui/button';
import { ConfirmDialog } from './confirm-dialog';

const meta = {
  title: 'UI/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    trigger: <Button variant="outline">Delete product</Button>,
    title: 'Delete “Clean Code”?',
    description: 'The product disappears from the catalog and from carts.',
    confirmLabel: 'Delete',
    pendingLabel: 'Deleting…',
    onConfirm: fn(async () => undefined),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete product' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await expect(args.onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  },
};

export const StaysOpenOnError: Story = {
  args: {
    onConfirm: fn(async () => {
      throw new Error('Category has products and cannot be deleted');
    }),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete product' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await expect(await screen.findByRole('alertdialog')).toBeVisible();
  },
};

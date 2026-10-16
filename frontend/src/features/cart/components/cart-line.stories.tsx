import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { cartItem } from '@/test/fixtures';
import { CartLine } from './cart-line';

const meta = {
  title: 'Cart/CartLine',
  component: CartLine,
  args: {
    item: cartItem({ quantity: 2, imageUrl: 'https://picsum.photos/seed/clean-code/200/200' }),
    onQuantityChange: fn(),
    onRemove: fn(),
  },
  decorators: [
    (Story) => (
      <ul className="max-w-2xl divide-y rounded-xl border px-4">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof CartLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Increase quantity' }));
    await expect(args.onQuantityChange).toHaveBeenCalledWith(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Clean Code' }));
    await expect(args.onRemove).toHaveBeenCalledOnce();
  },
};

export const NotEnoughStock: Story = {
  args: {
    item: cartItem({ quantity: 5, stock: 2, issue: 'INSUFFICIENT_STOCK' }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Only 2 available.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Set quantity to 2' }));
    await expect(args.onQuantityChange).toHaveBeenCalledWith(2);
  },
};

export const OutOfStock: Story = {
  args: { item: cartItem({ stock: 0, issue: 'OUT_OF_STOCK' }) },
};

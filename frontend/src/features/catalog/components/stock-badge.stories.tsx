import type { Meta, StoryObj } from '@storybook/react-vite';
import { StockBadge } from './stock-badge';

const meta = {
  title: 'Catalog/StockBadge',
  component: StockBadge,
  args: { stock: 12 },
  argTypes: { stock: { control: { type: 'number', min: 0 } } },
} satisfies Meta<typeof StockBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InStock: Story = {};
export const LowStock: Story = { args: { stock: 3 } };
export const OutOfStock: Story = { args: { stock: 0 } };

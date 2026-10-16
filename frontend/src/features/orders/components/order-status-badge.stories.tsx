import type { Meta, StoryObj } from '@storybook/react-vite';
import { ORDER_STATUSES } from '../order-status';
import { OrderStatusBadge } from './order-status-badge';

const meta = {
  title: 'Orders/OrderStatusBadge',
  component: OrderStatusBadge,
  args: { status: 'NEW' },
  argTypes: { status: { control: 'select', options: ORDER_STATUSES } },
} satisfies Meta<typeof OrderStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUSES.map((status) => (
        <OrderStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};

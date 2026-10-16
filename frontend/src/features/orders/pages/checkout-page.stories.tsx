import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { cartKeys } from '@/features/cart/api';
import { cart, cartItem, order } from '@/test/fixtures';
import { errorBody, type MockHandler } from '@/test/http';
import { customer } from '@/test/render';
import { storyParameters } from '@/test/storybook';
import { CheckoutPage } from './checkout-page';

const items = [
  cartItem({ quantity: 2 }),
  cartItem({
    productId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    name: 'Nova X Smartphone',
    price: 1_899_900,
    stock: 3,
  }),
];

const shortCart = cart([
  { ...items[1], quantity: 5, lineTotal: 5 * items[1].price, issue: 'INSUFFICIENT_STOCK' },
]);

const cartApi =
  (data = cart(items)): MockHandler =>
  (config) =>
    config.url === '/cart' ? { status: 200, data } : { status: 201, data: order() };

const meta = {
  tags: ['!autodocs'],
  title: 'Forms/Checkout',
  component: CheckoutPage,
  parameters: storyParameters({
    user: customer,
    route: '/checkout',
    queryData: [[cartKeys.all, cart(items)]],
    api: cartApi(),
  }),
} satisfies Meta<typeof CheckoutPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AddressRequired: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Place order/ }));
    await expect(
      await canvas.findByText('Enter the full shipping address (at least 5 characters)'),
    ).toBeVisible();
  },
};

export const OutOfStockWhilePaying: Story = {
  parameters: storyParameters({
    user: customer,
    route: '/checkout',
    queryData: [[cartKeys.all, cart(items)]],
    api: (config) =>
      config.url === '/orders'
        ? {
            status: 409,
            data: errorBody(409, 'Some items are not available in the requested quantity', {
              items: [
                {
                  productId: items[1].productId,
                  name: 'Nova X Smartphone',
                  requested: 1,
                  available: 0,
                },
              ],
            }),
          }
        : { status: 200, data: cart(items) },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Shipping address'), '1 Khreshchatyk St, Kyiv');
    await userEvent.click(canvas.getByRole('button', { name: /^Place order/ }));
    await expect(await canvas.findByText('Some items are no longer available')).toBeVisible();
    await expect(
      canvas.getByText('Nova X Smartphone: you asked for 1, out of stock'),
    ).toBeVisible();
  },
};

export const StockIssues: Story = {
  parameters: storyParameters({
    user: customer,
    route: '/checkout',
    queryData: [[cartKeys.all, shortCart]],
    api: cartApi(shortCart),
  }),
};

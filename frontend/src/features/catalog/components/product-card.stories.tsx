import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { product } from '@/test/fixtures';
import { ProductCard, ProductCardSkeleton } from './product-card';

const image = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

const meta = {
  title: 'Catalog/ProductCard',
  component: ProductCard,
  args: { product: product({ imageUrl: image('clean-code') }) },
  decorators: [
    (Story) => (
      <div className="w-60">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProductCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InStock: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement);
    await expect(card.getByRole('link', { name: 'Clean Code' })).toHaveAttribute(
      'href',
      '/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    await expect(card.getByText('₴599.00')).toBeVisible();
    await expect(card.getByText('In stock')).toBeVisible();
  },
};

export const LowStock: Story = {
  args: { product: product({ stock: 3, imageUrl: image('low') }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Only 3 left')).toBeVisible();
  },
};

export const OutOfStock: Story = {
  args: { product: product({ stock: 0, imageUrl: image('out') }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Out of stock')).toBeVisible();
  },
};

export const WithoutImage: Story = {
  args: { product: product({ imageUrl: null }) },
};

export const LongName: Story = {
  args: {
    product: product({
      name: 'Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems',
      price: 89_900,
      imageUrl: image('ddia'),
    }),
  },
};

export const Grid: Story = {
  decorators: [
    (Story) => (
      <div className="w-[min(100vw-2rem,52rem)]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <ProductCard product={product({ imageUrl: image('a') })} />
      <ProductCard
        product={product({
          id: 'b',
          name: 'Nova X Smartphone',
          price: 1_899_900,
          stock: 2,
          imageUrl: image('b'),
        })}
      />
      <ProductCard
        product={product({
          id: 'c',
          name: 'Ribbed Beanie',
          price: 39_900,
          stock: 0,
          imageUrl: image('c'),
        })}
      />
      <ProductCardSkeleton />
    </div>
  ),
};

export const Loading: Story = {
  render: () => <ProductCardSkeleton />,
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Pagination } from './pagination';

const meta = {
  title: 'UI/Pagination',
  component: Pagination,
  args: {
    page: 1,
    totalPages: 3,
    hrefFor: (page: number) => `/?page=${page}`,
    label: 'Catalog pages',
  },
  argTypes: {
    page: { control: { type: 'number', min: 1 } },
    totalPages: { control: { type: 'number', min: 0 } },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Catalog pages' });
    await expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};

export const ManyPages: Story = { args: { page: 7, totalPages: 20 } };

export const LastPage: Story = { args: { page: 3, totalPages: 3 } };

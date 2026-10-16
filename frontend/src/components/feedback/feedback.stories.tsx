import type { Meta, StoryObj } from '@storybook/react-vite';
import { PackageSearchIcon } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ButtonLink } from '@/components/button-link';
import { ApiError } from '@/lib/api/errors';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { PageLoader } from './page-loader';

const meta = {
  title: 'Feedback/States',
  component: EmptyState,
  args: {
    icon: PackageSearchIcon,
    title: 'No products match your filters',
    description: 'Try a different search or clear the filters.',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: (args) => (
    <EmptyState {...args}>
      <ButtonLink variant="outline" to="/">
        Clear filters
      </ButtonLink>
    </EmptyState>
  ),
};

const onRetry = fn();

export const Error: Story = {
  render: () => (
    <ErrorState
      title="Could not load products"
      error={
        new ApiError({
          status: 500,
          messages: ['Something went wrong on our side. Please try again later.'],
          requestId: '7f3c2a9e-1b4d-4c8e-9a51-0d2f6e8b3c47',
        })
      }
      onRetry={onRetry}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('7f3c2a9e-1b4d-4c8e-9a51-0d2f6e8b3c47')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(onRetry).toHaveBeenCalled();
  },
};

export const Offline: Story = {
  render: () => (
    <ErrorState
      title="Could not load your cart"
      error={
        new ApiError({
          status: 0,
          messages: ['Cannot reach the server. Check your connection and try again.'],
        })
      }
    />
  ),
};

export const Loading: Story = {
  render: () => <PageLoader label="Loading the admin panel…" />,
};

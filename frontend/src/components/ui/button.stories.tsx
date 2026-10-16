import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon, ShoppingCartIcon, Trash2Icon } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ButtonLink } from '@/components/button-link';
import { Button } from './button';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Add to cart' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: { control: 'select', options: ['xs', 'sm', 'default', 'lg'] },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const onAdd = fn();

export const Default: Story = {
  render: (args) => <Button {...args} onClick={() => onAdd()} />,
  play: async ({ canvasElement }) => {
    onAdd.mockClear();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add to cart' }));
    await expect(onAdd).toHaveBeenCalledOnce();
  },
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args}>Default</Button>
      <Button {...args} variant="outline">
        Outline
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="destructive">
        Destructive
      </Button>
      <Button {...args} variant="link">
        Link
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} size="xs">
        Extra small
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args}>Default</Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} size="lg">
        <ShoppingCartIcon data-icon="inline-start" />
        Add to cart
      </Button>
      <Button {...args} variant="outline">
        <PlusIcon data-icon="inline-start" />
        New product
      </Button>
      <Button {...args} variant="ghost" size="icon-sm" aria-label="Delete product">
        <Trash2Icon />
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Out of stock' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Out of stock' }),
    ).toBeDisabled();
  },
};

export const AsLink: Story = {
  render: () => (
    <div className="flex gap-2">
      <ButtonLink to="/register">Sign up</ButtonLink>
      <ButtonLink to="/login" variant="ghost">
        Log in
      </ButtonLink>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/register',
    );
  },
};

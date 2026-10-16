import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ApiError } from '@/lib/api/errors';
import { customer } from '@/test/render';
import { storyParameters } from '@/test/storybook';
import { RegisterForm } from './register-form';

const meta = {
  title: 'Forms/RegisterForm',
  component: RegisterForm,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RegisterForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Password'), 'short');
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'other');
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }));
    await expect(await canvas.findByText('Name is required')).toBeVisible();
    await expect(canvas.getByText('Password must be at least 8 characters')).toBeVisible();
    await expect(canvas.getByText('Passwords do not match')).toBeVisible();
  },
};

export const EmailTaken: Story = {
  parameters: storyParameters({
    auth: {
      register: fn(async () => {
        throw new ApiError({ status: 409, messages: ['This email is already registered'] });
      }),
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Demo Customer');
    await userEvent.type(canvas.getByLabelText('Email'), 'customer@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'Customer12345!');
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'Customer12345!');
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }));
    await expect(await canvas.findByText('This email is already registered')).toBeVisible();
  },
};

export const Success: Story = {
  parameters: storyParameters({ auth: { register: fn(async () => customer) } }),
};

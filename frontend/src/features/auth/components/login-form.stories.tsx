import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ApiError } from '@/lib/api/errors';
import { customer } from '@/test/render';
import { type StoryParameters, storyParameters } from '@/test/storybook';
import { LoginForm } from './login-form';

const meta = {
  title: 'Forms/LoginForm',
  component: LoginForm,
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));
    await expect(await canvas.findByText('Enter a valid email address')).toBeVisible();
    await expect(canvas.getByText('Password is required')).toBeVisible();
  },
};

export const Success: Story = {
  parameters: storyParameters({ auth: { login: fn(async () => customer) } }),
  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'customer@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'Customer12345!');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));
    await expect((parameters as StoryParameters).auth?.login).toHaveBeenCalledWith({
      email: 'customer@example.com',
      password: 'Customer12345!',
    });
  },
};

export const WrongPassword: Story = {
  parameters: storyParameters({
    auth: {
      login: fn(async () => {
        throw new ApiError({ status: 401, messages: ['Invalid email or password'] });
      }),
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'customer@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));
    await expect(await canvas.findByText('Invalid email or password')).toBeVisible();
  },
};

export const TooManyAttempts: Story = {
  parameters: storyParameters({
    auth: {
      login: fn(async () => {
        throw new ApiError({ status: 429, messages: ['Too many requests'], retryAfterSeconds: 42 });
      }),
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'customer@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'Customer12345!');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));
    await expect(
      await canvas.findByText('Too many attempts. Try again in 42 seconds.'),
    ).toBeVisible();
  },
};

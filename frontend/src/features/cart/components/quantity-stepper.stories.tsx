import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { QuantityStepper } from './quantity-stepper';

const meta = {
  title: 'Cart/QuantityStepper',
  component: QuantityStepper,
  args: { label: 'Quantity of Clean Code', value: 2, max: 5, onChange: fn() },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <QuantityStepper
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    );
  },
} satisfies Meta<typeof QuantityStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StopsAtStock: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const increase = canvas.getByRole('button', { name: 'Increase quantity' });
    await userEvent.click(increase);
    await userEvent.click(increase);
    await userEvent.click(increase);
    await expect(canvas.getByRole('textbox', { name: 'Quantity' })).toHaveValue('5');
    await expect(increase).toBeDisabled();
    await expect(args.onChange).toHaveBeenLastCalledWith(5);
  },
};

export const TypedValueIsClamped: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Quantity' });
    await userEvent.clear(input);
    await userEvent.type(input, '42{Enter}');
    await expect(input).toHaveValue('5');
    await expect(args.onChange).toHaveBeenCalledWith(5);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

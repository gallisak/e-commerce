import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuantityStepper } from './quantity-stepper';

function setup(value = 2, max = 5) {
  const onChange = vi.fn();
  render(
    <QuantityStepper label="Quantity of Clean Code" value={value} max={max} onChange={onChange} />,
  );
  return { onChange, input: screen.getByRole('textbox', { name: 'Quantity' }) };
}

describe('QuantityStepper', () => {
  it('steps up and down within the limits', async () => {
    const { onChange } = setup(1, 2);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('disables increase at the maximum', () => {
    setup(5, 5);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Quantity of Clean Code' })).toBeInTheDocument();
  });

  it('commits a typed value on Enter and clamps it to the maximum', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '42{Enter}');
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('commits on blur and ignores non-digits', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '3a');
    expect(input).toHaveValue('3');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('restores the value on Escape or when left empty', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '4{Escape}');
    expect(input).toHaveValue('2');
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue('2');
    expect(onChange).not.toHaveBeenCalled();
  });
});

import { isPriceInput, toKopecks, toPriceInput } from './price';

describe('price input', () => {
  it('accepts whole and decimal prices with a dot or comma', () => {
    expect(['599', '599.5', '599,99', ' 0.01 '].every(isPriceInput)).toBe(true);
    expect(['', '-1', '1.234', 'abc', '1e3', '12345678'].some(isPriceInput)).toBe(false);
  });

  it('converts to kopecks without floating point errors', () => {
    expect(toKopecks('599')).toBe(59_900);
    expect(toKopecks('599,5')).toBe(59_950);
    expect(toKopecks('0.07')).toBe(7);
    expect(toKopecks('1999.99')).toBe(199_999);
  });

  it('formats kopecks for editing', () => {
    expect(toPriceInput(59_950)).toBe('599.50');
    expect(toPriceInput(0)).toBe('0.00');
  });
});

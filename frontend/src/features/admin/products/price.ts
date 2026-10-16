export const MAX_PRICE_KOPECKS = 100_000_000;

const PRICE_PATTERN = /^\d{1,7}(?:[.,]\d{1,2})?$/;

export function isPriceInput(value: string): boolean {
  return PRICE_PATTERN.test(value.trim());
}

export function toKopecks(value: string): number {
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function toPriceInput(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}

import type { StockShortage } from '@/lib/api/types';

export function readShortages(body: unknown): StockShortage[] {
  if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items)) {
    return [];
  }
  return body.items.filter(
    (item): item is StockShortage =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.productId === 'string' &&
      typeof item.name === 'string' &&
      typeof item.requested === 'number' &&
      typeof item.available === 'number',
  );
}

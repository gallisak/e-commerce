import type { Category, Paginated, Product } from '@/lib/api/types';

export const categories: Category[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Books', slug: 'books', productsCount: 2 },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Electronics',
    slug: 'electronics',
    productsCount: 1,
  },
];

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Clean Code',
    description: 'Robert C. Martin. A classic on code quality.',
    price: 59_900,
    stock: 12,
    imageUrl: null,
    category: { id: categories[0].id, name: 'Books', slug: 'books' },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function page<T>(items: T[], meta: Partial<Paginated<T>['meta']> = {}): Paginated<T> {
  return {
    items,
    meta: { page: 1, limit: 12, total: items.length, totalPages: items.length ? 1 : 0, ...meta },
  };
}

import type {
  Cart,
  CartItem,
  Category,
  OrderDetail,
  OrderSummary,
  Paginated,
  Product,
} from '@/lib/api/types';

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

export function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  const item = {
    productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Clean Code',
    price: 59_900,
    imageUrl: null,
    stock: 12,
    quantity: 1,
    issue: null,
    ...overrides,
  };
  return { ...item, lineTotal: item.price * item.quantity };
}

export function cart(items: CartItem[] = []): Cart {
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
    hasIssues: items.some((item) => item.issue !== null),
  };
}

export const ORDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

export function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: ORDER_ID,
    status: 'NEW',
    totalAmount: 119_800,
    shippingAddress: '1 Test Street, Kyiv',
    cancelReason: null,
    customer: { id: 'u-customer', email: 'customer@example.com', name: 'Demo Customer' },
    items: [
      {
        productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        productName: 'Clean Code',
        unitPrice: 59_900,
        quantity: 2,
        lineTotal: 119_800,
      },
    ],
    statusHistory: [
      {
        fromStatus: null,
        toStatus: 'NEW',
        note: 'Order placed',
        byUser: true,
        createdAt: '2026-10-10T09:00:00.000Z',
      },
    ],
    createdAt: '2026-10-10T09:00:00.000Z',
    updatedAt: '2026-10-10T09:00:00.000Z',
    ...overrides,
  };
}

export function orderSummary(overrides: Partial<OrderSummary> = {}): OrderSummary {
  const { id, status, totalAmount, customer, createdAt, updatedAt } = order();
  return { id, status, totalAmount, itemsCount: 1, customer, createdAt, updatedAt, ...overrides };
}

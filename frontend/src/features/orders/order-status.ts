import type { OrderStatus } from '@/lib/api/types';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'NEW',
  'PROCESSING',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['NEW'];

export function isOrderStatus(value: string | null): value is OrderStatus {
  return value !== null && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function shortOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

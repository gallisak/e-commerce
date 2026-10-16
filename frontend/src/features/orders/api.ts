import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { OrderDetail, OrderStatus, OrderSummary, Paginated } from '@/lib/api/types';

export const ORDERS_PAGE_SIZE = 10;

export interface OrderListParams {
  page: number;
  status?: OrderStatus;
}

export const ordersApi = {
  async checkout(shippingAddress: string, idempotencyKey: string): Promise<OrderDetail> {
    const { data } = await api.post<OrderDetail>(
      '/orders',
      { shippingAddress },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return data;
  },

  async listMine(params: OrderListParams, signal?: AbortSignal): Promise<Paginated<OrderSummary>> {
    const { data } = await api.get<Paginated<OrderSummary>>('/orders', {
      params: { ...params, limit: ORDERS_PAGE_SIZE },
      signal,
    });
    return data;
  },

  async getMine(id: string, signal?: AbortSignal): Promise<OrderDetail> {
    const { data } = await api.get<OrderDetail>(`/orders/${encodeURIComponent(id)}`, { signal });
    return data;
  },

  async cancel(id: string, reason?: string): Promise<OrderDetail> {
    const { data } = await api.post<OrderDetail>(`/orders/${encodeURIComponent(id)}/cancel`, {
      reason,
    });
    return data;
  },
};

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: OrderListParams) => [...orderKeys.lists(), params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
};

export const PENDING_PAYMENT_POLL_MS = 2_000;

export const myOrdersQuery = (params: OrderListParams) =>
  queryOptions({
    queryKey: orderKeys.list(params),
    queryFn: ({ signal }) => ordersApi.listMine(params, signal),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((order) => order.status === 'NEW')
        ? PENDING_PAYMENT_POLL_MS
        : false,
  });

export const myOrderQuery = (id: string) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => ordersApi.getMine(id, signal),
    refetchInterval: (query) => (needsPolling(query.state.data) ? PENDING_PAYMENT_POLL_MS : false),
  });

export function needsPolling(order: OrderDetail | undefined): boolean {
  return order?.status === 'NEW' || order?.payment.status === 'REFUND_PENDING';
}

import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { PENDING_PAYMENT_POLL_MS } from '@/features/orders/api';
import { api } from '@/lib/api/client';
import type { OrderDetail, OrderStatus, OrderSummary, Paginated } from '@/lib/api/types';
import { addDays } from '@/lib/dates';

export const ADMIN_ORDERS_PAGE_SIZE = 20;

export interface AdminOrderFilters {
  page: number;
  status?: OrderStatus;
  from?: string;
  to?: string;
}

export const adminOrdersApi = {
  async list(filters: AdminOrderFilters, signal?: AbortSignal): Promise<Paginated<OrderSummary>> {
    const { data } = await api.get<Paginated<OrderSummary>>('/admin/orders', {
      params: {
        page: filters.page,
        status: filters.status,
        from: filters.from,
        to: filters.to ? addDays(filters.to, 1) : undefined,
        limit: ADMIN_ORDERS_PAGE_SIZE,
      },
      signal,
    });
    return data;
  },

  async get(id: string, signal?: AbortSignal): Promise<OrderDetail> {
    const { data } = await api.get<OrderDetail>(`/admin/orders/${encodeURIComponent(id)}`, {
      signal,
    });
    return data;
  },

  async updateStatus(id: string, status: OrderStatus, note?: string): Promise<OrderDetail> {
    const { data } = await api.patch<OrderDetail>(
      `/admin/orders/${encodeURIComponent(id)}/status`,
      { status, note },
    );
    return data;
  },
};

export const adminKeys = {
  all: ['admin'] as const,
  orders: () => [...adminKeys.all, 'orders'] as const,
  orderList: (filters: AdminOrderFilters) => [...adminKeys.orders(), 'list', filters] as const,
  order: (id: string) => [...adminKeys.orders(), 'detail', id] as const,
  analytics: () => [...adminKeys.all, 'analytics'] as const,
};

export const adminOrdersQuery = (filters: AdminOrderFilters) =>
  queryOptions({
    queryKey: adminKeys.orderList(filters),
    queryFn: ({ signal }) => adminOrdersApi.list(filters, signal),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((order) => order.status === 'NEW')
        ? PENDING_PAYMENT_POLL_MS
        : false,
  });

export const adminOrderQuery = (id: string) =>
  queryOptions({
    queryKey: adminKeys.order(id),
    queryFn: ({ signal }) => adminOrdersApi.get(id, signal),
    refetchInterval: (query) =>
      query.state.data?.status === 'NEW' ? PENDING_PAYMENT_POLL_MS : false,
  });

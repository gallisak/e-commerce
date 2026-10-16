import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Cart } from '@/lib/api/types';

export const cartApi = {
  async get(signal?: AbortSignal): Promise<Cart> {
    const { data } = await api.get<Cart>('/cart', { signal });
    return data;
  },

  async addItem(productId: string, quantity: number): Promise<Cart> {
    const { data } = await api.post<Cart>('/cart/items', { productId, quantity });
    return data;
  },

  async updateItem(productId: string, quantity: number): Promise<Cart> {
    const { data } = await api.patch<Cart>(`/cart/items/${encodeURIComponent(productId)}`, {
      quantity,
    });
    return data;
  },

  async removeItem(productId: string): Promise<Cart> {
    const { data } = await api.delete<Cart>(`/cart/items/${encodeURIComponent(productId)}`);
    return data;
  },

  async clear(): Promise<Cart> {
    const { data } = await api.delete<Cart>('/cart');
    return data;
  },
};

export const cartKeys = {
  all: ['cart'] as const,
};

export const cartQuery = () =>
  queryOptions({
    queryKey: cartKeys.all,
    queryFn: ({ signal }) => cartApi.get(signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

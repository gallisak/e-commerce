import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { catalogKeys } from '@/features/catalog/api';
import { api } from '@/lib/api/client';
import type { Paginated, Product } from '@/lib/api/types';

export const ADMIN_PAGE_SIZE = 20;

export interface AdminProductListParams {
  page: number;
  search?: string;
  categoryId?: string;
}

export interface ProductPayload {
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  imageUrl?: string | null;
}

export const adminProductsApi = {
  async list(params: AdminProductListParams, signal?: AbortSignal): Promise<Paginated<Product>> {
    const { data } = await api.get<Paginated<Product>>('/products', {
      params: { ...params, limit: ADMIN_PAGE_SIZE },
      signal,
    });
    return data;
  },

  async create(payload: ProductPayload): Promise<Product> {
    const { data } = await api.post<Product>('/products', payload);
    return data;
  },

  async update(id: string, payload: Partial<ProductPayload>): Promise<Product> {
    const { data } = await api.patch<Product>(`/products/${encodeURIComponent(id)}`, payload);
    return data;
  },

  async uploadImage(id: string, file: File): Promise<Product> {
    const body = new FormData();
    body.append('file', file);
    const { data } = await api.post<Product>(`/products/${encodeURIComponent(id)}/image`, body);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/products/${encodeURIComponent(id)}`);
  },
};

export const adminProductsQuery = (params: AdminProductListParams) =>
  queryOptions({
    queryKey: [...catalogKeys.all, 'admin-products', params] as const,
    queryFn: ({ signal }) => adminProductsApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

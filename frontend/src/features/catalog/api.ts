import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Category, Paginated, Product, ProductSort } from '@/lib/api/types';

export const PAGE_SIZE = 12;

export interface ProductListParams {
  page: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: ProductSort;
}

export const catalogApi = {
  async listProducts(params: ProductListParams, signal?: AbortSignal): Promise<Paginated<Product>> {
    const { data } = await api.get<Paginated<Product>>('/products', {
      params: { ...params, limit: PAGE_SIZE },
      signal,
    });
    return data;
  },

  async getProduct(id: string, signal?: AbortSignal): Promise<Product> {
    const { data } = await api.get<Product>(`/products/${encodeURIComponent(id)}`, { signal });
    return data;
  },

  async listCategories(signal?: AbortSignal): Promise<Category[]> {
    const { data } = await api.get<Category[]>('/categories', { signal });
    return data;
  },
};

export const catalogKeys = {
  all: ['catalog'] as const,
  products: (params: ProductListParams) => [...catalogKeys.all, 'products', params] as const,
  product: (id: string) => [...catalogKeys.all, 'product', id] as const,
  categories: () => [...catalogKeys.all, 'categories'] as const,
};

export const productsQuery = (params: ProductListParams) =>
  queryOptions({
    queryKey: catalogKeys.products(params),
    queryFn: ({ signal }) => catalogApi.listProducts(params, signal),
    placeholderData: keepPreviousData,
  });

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: catalogKeys.product(id),
    queryFn: ({ signal }) => catalogApi.getProduct(id, signal),
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: catalogKeys.categories(),
    queryFn: ({ signal }) => catalogApi.listCategories(signal),
    staleTime: 5 * 60_000,
  });

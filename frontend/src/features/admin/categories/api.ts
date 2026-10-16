import { api } from '@/lib/api/client';
import type { Category } from '@/lib/api/types';

export interface CategoryPayload {
  name: string;
  slug?: string;
}

export const adminCategoriesApi = {
  async create(payload: CategoryPayload): Promise<Category> {
    const { data } = await api.post<Category>('/categories', payload);
    return data;
  },

  async update(id: string, payload: CategoryPayload): Promise<Category> {
    const { data } = await api.patch<Category>(`/categories/${encodeURIComponent(id)}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/categories/${encodeURIComponent(id)}`);
  },
};

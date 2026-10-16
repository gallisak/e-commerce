import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { AuthResponse, User } from '@/lib/api/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', input, { skipAuthRefresh: true });
    return data;
  },

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', input, {
      skipAuthRefresh: true,
    });
    return data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout', undefined, { skipAuthRefresh: true });
  },

  async me(signal?: AbortSignal): Promise<User> {
    const { data } = await api.get<User>('/users/me', { signal });
    return data;
  },
};

export const profileQuery = () =>
  queryOptions({
    queryKey: ['users', 'me'] as const,
    queryFn: ({ signal }) => authApi.me(signal),
  });

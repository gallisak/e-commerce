import axios, { type InternalAxiosRequestConfig } from 'axios';
import { toApiError } from './errors';
import { session } from './session';
import { sessionHint } from './session-hint';
import type { AuthResponse } from './types';

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  authRetried?: boolean;
}

export const REFRESH_LOCK_NAME = 'mini-marketplace:auth-refresh';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = session.getAccessToken();
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(undefined, async (error: unknown) => {
  const apiError = toApiError(error);
  const config = (error as { config?: RetriableConfig }).config;

  if (apiError.status !== 401 || !config || config.skipAuthRefresh || config.authRetried) {
    throw apiError;
  }

  config.authRetried = true;
  const refreshed = await refreshSession().catch(() => null);
  if (!refreshed) throw apiError;

  config.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
  return api.request(config);
});

let refreshInFlight: Promise<AuthResponse | null> | null = null;

export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= withRefreshLock(requestRefresh).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function requestRefresh(): Promise<AuthResponse | null> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/refresh', undefined, {
      skipAuthRefresh: true,
    });
    session.signIn(data.user, data.accessToken);
    sessionHint.set();
    return data;
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 401) {
      sessionHint.clear();
      session.signOut();
      return null;
    }
    throw apiError;
  }
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request(REFRESH_LOCK_NAME, task) : task();
}

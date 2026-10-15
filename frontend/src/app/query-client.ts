import { QueryClient } from '@tanstack/react-query';
import { toApiError } from '@/lib/api/errors';

const MAX_RETRIES = 2;

export function isRetryableError(error: unknown): boolean {
  const { status } = toApiError(error);
  return status === 0 || status === 502 || status === 503 || status === 504;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryableError(error),
      },
      mutations: { retry: false },
    },
  });
}

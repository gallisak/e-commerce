import { isAxiosError } from 'axios';
import type { ApiErrorBody } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly requestId?: string;
  readonly body?: ApiErrorBody;
  readonly retryAfterSeconds?: number;

  constructor(options: {
    status: number;
    messages: string[];
    requestId?: string;
    body?: ApiErrorBody;
    retryAfterSeconds?: number;
  }) {
    super(options.messages.join('. '));
    this.name = 'ApiError';
    this.status = options.status;
    this.messages = options.messages;
    this.requestId = options.requestId;
    this.body = options.body;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Cannot reach the server. Check your connection and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to do this.',
  404: 'The requested resource was not found.',
  413: 'The file is too large.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
};

function fallbackMessage(status: number): string {
  return FALLBACK_MESSAGES[status] ?? (status >= 500 ? FALLBACK_MESSAGES[500] : 'Request failed.');
}

function isErrorBody(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && 'statusCode' in data && 'message' in data;
}

function parseRetryAfter(headers: unknown): number | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const record = headers as Record<string, unknown>;
  for (const name of ['retry-after-login', 'retry-after-default', 'retry-after']) {
    const seconds = Number(record[name]);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  }
  return undefined;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    const response = error.response;
    if (!response) {
      return new ApiError({ status: 0, messages: [fallbackMessage(0)] });
    }
    const body = isErrorBody(response.data) ? response.data : undefined;
    const raw = body?.message;
    const messages = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
    const status = response.status;
    return new ApiError({
      status,
      messages: status >= 500 || messages.length === 0 ? [fallbackMessage(status)] : messages,
      requestId: body?.requestId ?? (response.headers?.['x-request-id'] as string | undefined),
      body,
      retryAfterSeconds: parseRetryAfter(response.headers),
    });
  }

  return new ApiError({ status: -1, messages: ['Unexpected error. Please try again.'] });
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}

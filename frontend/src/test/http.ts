import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { api } from '@/lib/api/client';

export interface MockReply {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

export type MockHandler = (config: InternalAxiosRequestConfig) => MockReply | Promise<MockReply>;

export function mockApi(handler: MockHandler) {
  const calls: InternalAxiosRequestConfig[] = [];
  const original = api.defaults.adapter;

  api.defaults.adapter = async (config) => {
    calls.push(config);
    const reply = await handler(config);
    const response: AxiosResponse = {
      data: reply.data ?? null,
      status: reply.status,
      statusText: String(reply.status),
      headers: new AxiosHeaders(reply.headers ?? {}),
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${reply.status}`,
        AxiosError.ERR_BAD_RESPONSE,
        config,
        null,
        response,
      );
    }
    return response;
  };

  return {
    calls,
    restore: () => {
      api.defaults.adapter = original;
    },
  };
}

export function errorBody(statusCode: number, message: string | string[], extra = {}) {
  return {
    statusCode,
    error: 'Error',
    message,
    path: '/api/test',
    timestamp: new Date().toISOString(),
    requestId: 'req-test-0001',
    ...extra,
  };
}

export const authHeader = (config: InternalAxiosRequestConfig) =>
  config.headers.get('Authorization') as string | undefined;

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, errorMessage, toApiError } from './errors';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function axiosError(status: number, data: unknown, headers: Record<string, string> = {}) {
  return new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(headers),
    config,
  });
}

describe('toApiError', () => {
  it('keeps validation messages and the request id', () => {
    const error = toApiError(
      axiosError(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: ['email must be an email', 'password should not be empty'],
        requestId: 'req-1',
      }),
    );

    expect(error).toMatchObject({
      status: 400,
      messages: ['email must be an email', 'password should not be empty'],
      requestId: 'req-1',
    });
    expect(error.message).toBe('email must be an email. password should not be empty');
  });

  it('exposes domain fields of the error body', () => {
    const body = { statusCode: 409, error: 'Conflict', message: 'Only 2 left', available: 2 };
    expect(toApiError(axiosError(409, body)).body).toMatchObject({ available: 2 });
  });

  it('hides server error details behind a friendly message', () => {
    const error = toApiError(
      axiosError(500, { statusCode: 500, error: 'Internal', message: 'Internal server error' }),
    );
    expect(error.message).toBe('Something went wrong on our side. Please try again later.');
  });

  it('reports network failures with status 0', () => {
    const error = toApiError(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config));
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toMatch(/cannot reach the server/i);
  });

  it('reads the rate limit retry delay from headers', () => {
    const error = toApiError(
      axiosError(
        429,
        { statusCode: 429, error: 'Too Many Requests', message: 'ThrottlerException' },
        { 'retry-after-login': '42' },
      ),
    );
    expect(error.retryAfterSeconds).toBe(42);
  });

  it('falls back to the request id header and to a status based message', () => {
    const error = toApiError(axiosError(404, '<html>', { 'x-request-id': 'req-2' }));
    expect(error).toMatchObject({
      requestId: 'req-2',
      messages: ['The requested resource was not found.'],
    });
  });

  it('passes ApiError through and wraps unknown values', () => {
    const original = new ApiError({ status: 418, messages: ['teapot'] });
    expect(toApiError(original)).toBe(original);
    expect(errorMessage(new TypeError('boom'))).toBe('Unexpected error. Please try again.');
  });
});

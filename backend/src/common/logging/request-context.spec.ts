import type { NextFunction, Request, Response } from 'express';
import {
  currentRequestId,
  REQUEST_ID_HEADER,
  requestContextMiddleware,
} from './request-context.js';

const run = (incoming: string | undefined) => {
  const setHeader = vi.fn();
  let seen: string | undefined;
  requestContextMiddleware(
    { header: () => incoming } as unknown as Request,
    { setHeader } as unknown as Response,
    (() => {
      seen = currentRequestId();
    }) as NextFunction,
  );
  return { header: setHeader.mock.calls[0], seen };
};

describe('requestContextMiddleware', () => {
  it('keeps a well-formed incoming request id', () => {
    const { header, seen } = run('client-abc-123');
    expect(header).toEqual([REQUEST_ID_HEADER, 'client-abc-123']);
    expect(seen).toBe('client-abc-123');
  });

  it.each([undefined, 'short', 'has spaces in it', 'x'.repeat(65), 'line\nbreak-123456'])(
    'generates a new id for %j',
    (incoming) => {
      const { header, seen } = run(incoming);
      expect(seen).toMatch(/^[0-9a-f-]{36}$/);
      expect(header).toEqual([REQUEST_ID_HEADER, seen]);
    },
  );

  it('has no request id outside of a request', () => {
    expect(currentRequestId()).toBeUndefined();
  });
});

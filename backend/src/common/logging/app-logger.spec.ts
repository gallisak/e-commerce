import { AppLogger, escapeControlChars } from './app-logger.js';
import { requestContextMiddleware } from './request-context.js';
import type { NextFunction, Request, Response } from 'express';

const capture = () => {
  const lines: string[] = [];
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  return {
    lines,
    restore: () => {
      stdout.mockRestore();
      stderr.mockRestore();
    },
  };
};

const runInRequest = (requestId: string, fn: () => void) => {
  const req = { header: () => requestId } as unknown as Request;
  const res = { setHeader: vi.fn() } as unknown as Response;
  requestContextMiddleware(req, res, fn as NextFunction);
};

describe('escapeControlChars', () => {
  it('escapes line breaks and other control characters', () => {
    expect(escapeControlChars('a\nb\r\tc\u0007d')).toBe('a\\nb\\r\\tc\\u0007d');
  });

  it('keeps unicode text intact', () => {
    expect(escapeControlChars('Café «Nova» — 100%')).toBe('Café «Nova» — 100%');
  });
});

describe('AppLogger', () => {
  it('prevents forged log lines by escaping control characters in text mode', () => {
    const output = capture();
    try {
      new AppLogger({ level: 'log', json: false }).log(
        'Product created: "x"\n[Nest] 1 - LOG [AuthService] User logged in: admin',
        'ProductsService',
      );
    } finally {
      output.restore();
    }
    const printed = output.lines.join('');
    expect(printed.trimEnd().split('\n')).toHaveLength(1);
    expect(printed).toContain('"x"\\n[Nest] 1 - LOG');
  });

  it('does not emit ANSI colors when stdout is not a terminal', () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true });
    const output = capture();
    try {
      new AppLogger({ level: 'log', json: false }).log('plain', 'Test');
    } finally {
      output.restore();
      if (descriptor) Object.defineProperty(process.stdout, 'isTTY', descriptor);
      else delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
    expect(output.lines.join('')).not.toContain('\u001b[');
  });

  it('adds the request id and redacts secrets in JSON mode', () => {
    const output = capture();
    try {
      runInRequest('req-12345678', () => {
        new AppLogger({ level: 'log', json: true }).log(
          'Login attempt',
          {
            email: 'a@example.com',
            password: 'Secret123',
          },
          'AuthService',
        );
      });
    } finally {
      output.restore();
    }
    const entry = JSON.parse(output.lines.join(''));
    expect(entry).toMatchObject({
      level: 'log',
      message: 'Login attempt',
      context: 'AuthService',
      params: { requestId: 'req-12345678', email: 'a@example.com', password: '[REDACTED]' },
    });
  });

  it('respects the configured log level', () => {
    const output = capture();
    try {
      const logger = new AppLogger({ level: 'warn', json: true });
      logger.log('hidden');
      logger.debug('hidden');
      logger.warn('shown');
    } finally {
      output.restore();
    }
    expect(output.lines).toHaveLength(1);
    expect(JSON.parse(output.lines[0]).message).toBe('shown');
  });
});

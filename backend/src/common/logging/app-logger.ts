import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { currentRequestId } from './request-context.js';

export const LOG_LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

export const REDACTED_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
];

const CONTROL_CHARS = /\p{Cc}/gu;

export function escapeControlChars(text: string): string {
  return text.replace(CONTROL_CHARS, (char) => {
    switch (char) {
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\t':
        return '\\t';
      default:
        return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
    }
  });
}

export interface AppLoggerOptions {
  level: LogLevel;
  json: boolean;
}

export class AppLogger extends ConsoleLogger {
  constructor({ level, json }: AppLoggerOptions) {
    super({
      json,
      colors: !json && process.stdout.isTTY === true,
      logLevels: LOG_LEVELS.slice(0, LOG_LEVELS.indexOf(level) + 1),
      redact: REDACTED_KEYS,
    });
  }

  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
    params?: Record<string, unknown>,
  ): void {
    const requestId = currentRequestId();
    super.printMessages(
      messages.map((message) =>
        typeof message === 'string' ? escapeControlChars(message) : message,
      ),
      context,
      logLevel,
      writeStreamType,
      errorStack,
      requestId ? { ...params, requestId } : params,
    );
  }
}

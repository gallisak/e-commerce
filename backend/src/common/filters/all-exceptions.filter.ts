import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { currentRequestId } from '../logging/request-context.js';
import { mapPrismaError } from './prisma-error.mapper.js';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { status, payload } = this.describe(exception);
    const route = `${request.method} ${request.originalUrl}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const reason = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${route} failed with ${status}: ${summarize(reason)}`, reason.stack);
    }

    if (response.headersSent) {
      response.destroy();
      return;
    }

    const body: ErrorResponseBody = {
      ...payload,
      statusCode: status,
      error: (payload.error as string | undefined) ?? STATUS_CODES[status] ?? 'Error',
      message:
        (payload.message as string | string[] | undefined) ?? STATUS_CODES[status] ?? 'Error',
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: currentRequestId(),
    };
    response.status(status).json(body);
  }

  private describe(exception: unknown): { status: number; payload: Record<string, unknown> } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      return {
        status: exception.getStatus(),
        payload: typeof response === 'string' ? { message: response } : { ...(response as object) },
      };
    }

    const mapped = mapPrismaError(exception);
    if (mapped) return { status: mapped.status, payload: { message: mapped.message } };

    const clientError = asExposedClientError(exception);
    if (clientError) return clientError;

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      payload: { message: 'Internal server error' },
    };
  }
}

function asExposedClientError(
  exception: unknown,
): { status: number; payload: Record<string, unknown> } | null {
  const candidate = exception as { status?: unknown; expose?: unknown; message?: unknown } | null;
  if (
    typeof candidate?.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500 &&
    candidate.expose === true
  ) {
    return {
      status: candidate.status,
      payload: { message: typeof candidate.message === 'string' ? candidate.message : undefined },
    };
  }
  return null;
}

function summarize(error: Error): string {
  const code = (error as { code?: unknown }).code;
  const message = error.message.replace(/\s+/g, ' ').trim().slice(0, 300) || error.name;
  return typeof code === 'string' ? `[${code}] ${message}` : message;
}

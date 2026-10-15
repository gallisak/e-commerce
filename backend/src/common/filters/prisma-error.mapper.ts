import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

export interface MappedError {
  status: HttpStatus;
  message: string;
}

const UNAVAILABLE: MappedError = {
  status: HttpStatus.SERVICE_UNAVAILABLE,
  message: 'Service temporarily unavailable',
};

const PRISMA_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2028']);

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
]);

const POSTGRES_UNAVAILABLE_SQLSTATE = /^(08|57P0[1-3]$|53300$)/;

const UNAVAILABLE_MESSAGE =
  /can't reach database server|connection (?:refused|terminated)|server closed the connection|timed? ?out/i;

export function isDatabaseUnavailable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return false;
  return (
    PRISMA_UNAVAILABLE_CODES.has(code) ||
    NETWORK_ERROR_CODES.has(code) ||
    POSTGRES_UNAVAILABLE_SQLSTATE.test(code)
  );
}

function isRawQueryConnectionFailure(error: Prisma.PrismaClientKnownRequestError): boolean {
  if (error.code !== 'P2010') return false;
  const meta = error.meta as { code?: unknown; message?: unknown } | undefined;
  return (
    isDatabaseUnavailable(meta) ||
    UNAVAILABLE_MESSAGE.test(typeof meta?.message === 'string' ? meta.message : error.message)
  );
}

export function mapPrismaError(error: unknown): MappedError | null {
  if (error instanceof Prisma.PrismaClientInitializationError || isDatabaseUnavailable(error)) {
    return UNAVAILABLE;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && isRawQueryConnectionFailure(error)) {
    return UNAVAILABLE;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
      case 'P2003':
        return { status: HttpStatus.CONFLICT, message: 'Operation violates a relation constraint' };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
      case 'P2034':
      case '40001':
      case '40P01':
        return { status: HttpStatus.CONFLICT, message: 'Concurrent update conflict, please retry' };
      default:
        return null;
    }
  }
  return null;
}

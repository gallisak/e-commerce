import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { isDatabaseUnavailable, mapPrismaError } from './prisma-error.mapper.js';

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('failure', { code, clientVersion: 'test' });

describe('mapPrismaError', () => {
  it.each([
    ['P2002', HttpStatus.CONFLICT],
    ['P2003', HttpStatus.CONFLICT],
    ['P2025', HttpStatus.NOT_FOUND],
    ['P2034', HttpStatus.CONFLICT],
    ['40P01', HttpStatus.CONFLICT],
    ['P1001', HttpStatus.SERVICE_UNAVAILABLE],
    ['P2024', HttpStatus.SERVICE_UNAVAILABLE],
    ['ECONNREFUSED', HttpStatus.SERVICE_UNAVAILABLE],
    ['08006', HttpStatus.SERVICE_UNAVAILABLE],
    ['57P01', HttpStatus.SERVICE_UNAVAILABLE],
  ])('maps %s to %i', (code, status) => {
    expect(mapPrismaError(known(code))?.status).toBe(status);
  });

  it('treats driver-level connection errors outside Prisma as unavailability', () => {
    const error = Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });
    expect(mapPrismaError(error)).toEqual({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Service temporarily unavailable',
    });
  });

  it('detects connection failures wrapped in raw query errors (P2010)', () => {
    const raw = (meta: Record<string, string>) =>
      new Prisma.PrismaClientKnownRequestError('Raw query failed', {
        code: 'P2010',
        clientVersion: 'test',
        meta,
      });
    expect(
      mapPrismaError(raw({ code: 'N/A', message: "Can't reach database server at postgres" }))
        ?.status,
    ).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mapPrismaError(raw({ code: '57P01', message: 'terminating connection' }))?.status).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(mapPrismaError(raw({ code: '42601', message: 'syntax error at or near' }))).toBeNull();
  });

  it('leaves unknown errors unmapped', () => {
    expect(mapPrismaError(known('P2010'))).toBeNull();
    expect(mapPrismaError(new Error('boom'))).toBeNull();
    expect(isDatabaseUnavailable(Object.assign(new Error('x'), { code: '23505' }))).toBe(false);
  });
});

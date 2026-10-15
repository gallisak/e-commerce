import { BadRequestException } from '@nestjs/common';
import { localDate } from '../common/utils/dates.js';
import { MAX_RANGE_DAYS, resolveRange } from './date-range.js';

const TZ = 'Europe/Kyiv';

describe('date range', () => {
  it('defaults to the last 30 days including today in the store time zone', () => {
    const now = new Date('2026-10-15T22:30:00Z');
    expect(localDate(now, TZ)).toBe('2026-10-16');
    expect(resolveRange({}, TZ, now)).toEqual({ from: '2026-09-17', to: '2026-10-17', days: 30 });
  });

  it('uses explicit bounds and derives a missing "from"', () => {
    expect(resolveRange({ from: '2026-10-01', to: '2026-10-08' }, TZ)).toEqual({
      from: '2026-10-01',
      to: '2026-10-08',
      days: 7,
    });
    expect(resolveRange({ to: '2026-03-01' }, TZ).from).toBe('2026-01-30');
  });

  it.each([
    [{ from: '2026-10-08', to: '2026-10-08' }, 'earlier'],
    [{ from: '2026-10-09', to: '2026-10-08' }, 'earlier'],
    [{ from: '2024-01-01', to: '2026-01-01' }, `${MAX_RANGE_DAYS} days`],
    [{ from: '2026-02-31' }, 'not a valid calendar date'],
    [{ to: '2026-04-31' }, 'not a valid calendar date'],
  ])('rejects %j', (query, message) => {
    expect(() => resolveRange(query, TZ)).toThrow(BadRequestException);
    expect(() => resolveRange(query, TZ)).toThrow(message);
  });

  it('is not affected by DST changes', () => {
    expect(resolveRange({ from: '2026-10-20', to: '2026-10-27' }, TZ).days).toBe(7);
    expect(resolveRange({ from: '2026-03-27', to: '2026-03-31' }, TZ).days).toBe(4);
  });
});

import { BadRequestException } from '@nestjs/common';
import { addDays, daysBetween, isCalendarDate, localDate } from '../common/utils/dates.js';

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

export interface DateRange {
  from: string;
  to: string;
  days: number;
}

export function resolveRange(
  query: { from?: string; to?: string },
  timeZone: string,
  now: Date = new Date(),
): DateRange {
  for (const [name, value] of [
    ['from', query.from],
    ['to', query.to],
  ] as const) {
    if (value !== undefined && !isCalendarDate(value)) {
      throw new BadRequestException(`${name} is not a valid calendar date`);
    }
  }
  const to = query.to ?? addDays(localDate(now, timeZone), 1);
  const from = query.from ?? addDays(to, -DEFAULT_RANGE_DAYS);
  const days = daysBetween(from, to);

  if (days <= 0) throw new BadRequestException('"from" must be earlier than "to"');
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Date range must not exceed ${MAX_RANGE_DAYS} days`);
  }
  return { from, to, days };
}

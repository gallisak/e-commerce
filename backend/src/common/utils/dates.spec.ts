import { addDays, daysBetween, isCalendarDate, localDate, startOfLocalDay } from './dates.js';

describe('dates', () => {
  it('validates real calendar dates', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-04-31')).toBe(false);
  });

  it('adds days across month and leap-year boundaries', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
  });

  it('formats the local date in a time zone', () => {
    expect(localDate(new Date('2026-10-15T22:30:00Z'), 'Europe/Kyiv')).toBe('2026-10-16');
    expect(localDate(new Date('2026-10-15T22:30:00Z'), 'UTC')).toBe('2026-10-15');
  });

  it.each([
    ['2026-10-15', '2026-10-14T21:00:00.000Z'],
    ['2026-01-15', '2026-01-14T22:00:00.000Z'],
    ['2026-03-29', '2026-03-28T22:00:00.000Z'],
    ['2026-03-30', '2026-03-29T21:00:00.000Z'],
    ['2026-10-25', '2026-10-24T21:00:00.000Z'],
    ['2026-10-26', '2026-10-25T22:00:00.000Z'],
  ])('finds local midnight of %s in Kyiv (DST aware)', (date, expected) => {
    expect(startOfLocalDay(date, 'Europe/Kyiv').toISOString()).toBe(expected);
  });

  it('works for UTC and western time zones', () => {
    expect(startOfLocalDay('2026-10-15', 'UTC').toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(startOfLocalDay('2026-07-04', 'America/New_York').toISOString()).toBe(
      '2026-07-04T04:00:00.000Z',
    );
  });
});

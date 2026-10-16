import { addDays, daysBetween, formatDay, isDateString, localToday } from './dates';

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isDateString('2026-10-16')).toBe(true);
    expect(isDateString('2028-02-29')).toBe(true);
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-1-5')).toBe(false);
    expect(isDateString(null)).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('uses the local calendar day for today', () => {
    expect(localToday(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });

  it('formats days without shifting the time zone', () => {
    expect(formatDay('2026-10-01')).toBe('1 Oct 2026');
    expect(formatDay('2026-10-01', 'short')).toBe('1 Oct');
  });
});

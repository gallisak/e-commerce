import { addDays, daysBetween, isDateString, localToday } from '@/lib/dates';
import type { DateRange } from './api';

export const MAX_RANGE_DAYS = 366;
export const PRESETS = [7, 30, 90] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = 30;

export function presetRange(days: number, today = localToday()): Required<DateRange> {
  return { from: addDays(today, -(days - 1)), to: today };
}

export function readRange(params: URLSearchParams): DateRange {
  const from = params.get('from');
  const to = params.get('to');
  if (!isDateString(from) || !isDateString(to)) return {};
  const span = daysBetween(from, to) + 1;
  return span >= 1 && span <= MAX_RANGE_DAYS ? { from, to } : {};
}

export function activePreset(range: DateRange, today = localToday()): Preset | null {
  if (!range.from && !range.to) return DEFAULT_PRESET;
  return (
    PRESETS.find((days) => {
      const preset = presetRange(days, today);
      return preset.from === range.from && preset.to === range.to;
    }) ?? null
  );
}

export function validateRange(from: string, to: string): string | null {
  if (!isDateString(from) || !isDateString(to)) return 'Choose both dates';
  if (from > to) return 'The start date must not be after the end date';
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
    return `The period must not exceed ${MAX_RANGE_DAYS} days`;
  }
  return null;
}

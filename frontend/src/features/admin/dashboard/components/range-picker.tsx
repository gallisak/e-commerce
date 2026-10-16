import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DateRange } from '../api';
import { activePreset, PRESETS, presetRange, validateRange } from '../range';

interface RangePickerProps {
  range: DateRange;
  initial: DateRange;
  onChange: (range: DateRange) => void;
}

export function RangePicker({ range, initial, onChange }: RangePickerProps) {
  const preset = activePreset(range);
  const [draftFrom, setFrom] = useState<string | null>(null);
  const [draftTo, setTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const from = draftFrom ?? initial.from ?? '';
  const to = draftTo ?? initial.to ?? '';

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const problem = validateRange(from, to);
    setError(problem);
    if (!problem) onChange({ from, to });
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div role="group" aria-label="Period" className="flex gap-1 rounded-lg border p-0.5">
        {PRESETS.map((days) => (
          <Button
            key={days}
            type="button"
            size="sm"
            variant={preset === days ? 'secondary' : 'ghost'}
            aria-pressed={preset === days}
            onClick={() => {
              setError(null);
              const next = presetRange(days);
              setFrom(next.from);
              setTo(next.to);
              onChange(next);
            }}
          >
            {days} days
          </Button>
        ))}
      </div>
      <form noValidate onSubmit={apply} className="space-y-1.5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-from">From</Label>
            <Input
              id="dashboard-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-to">To</Label>
            <Input
              id="dashboard-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-40"
            />
          </div>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

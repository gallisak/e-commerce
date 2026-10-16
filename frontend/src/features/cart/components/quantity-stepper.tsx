import { MinusIcon, PlusIcon } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  max: number;
  min?: number;
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function QuantityStepper({
  value,
  max,
  min = 1,
  label,
  onChange,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const change = (next: number) => {
    const clamped = Math.min(Math.max(next, min), Math.max(max, min));
    if (clamped !== value) onChange(clamped);
  };

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const parsed = Number(draft);
    if (draft.trim() !== '' && Number.isInteger(parsed)) change(parsed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      setDraft(null);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center rounded-lg border', className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => change(value - 1)}
      >
        <MinusIcon />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Quantity"
        value={draft ?? String(value)}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 2))}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="h-7 w-10 bg-transparent text-center text-sm tabular-nums outline-none disabled:opacity-50"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => change(value + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

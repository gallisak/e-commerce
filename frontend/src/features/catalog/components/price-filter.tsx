import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_PRICE_UAH } from '../catalog-params';

interface PriceFilterProps {
  min: number | null;
  max: number | null;
  onApply: (range: { minPrice: number | null; maxPrice: number | null }) => void;
}

const toText = (value: number | null) => (value === null ? '' : String(value));

function parse(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const value = Number(trimmed);
  return value <= MAX_PRICE_UAH ? value : 'invalid';
}

export function PriceFilter({ min, max, onApply }: PriceFilterProps) {
  const [minText, setMinText] = useState(toText(min));
  const [maxText, setMaxText] = useState(toText(max));
  const [synced, setSynced] = useState({ min, max });
  const [error, setError] = useState<string | null>(null);

  if (synced.min !== min || synced.max !== max) {
    setSynced({ min, max });
    setMinText(toText(min));
    setMaxText(toText(max));
    setError(null);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const minPrice = parse(minText);
    const maxPrice = parse(maxText);
    if (minPrice === 'invalid' || maxPrice === 'invalid') {
      setError(`Enter whole numbers from 0 to ${MAX_PRICE_UAH.toLocaleString('en-US')}`);
      return;
    }
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      setError('Minimum price cannot be greater than maximum');
      return;
    }
    setError(null);
    onApply({ minPrice, maxPrice });
  };

  return (
    <form onSubmit={submit} noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Price, ₴</legend>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minimum price"
            inputMode="numeric"
            placeholder="Min"
            value={minText}
            onChange={(event) => setMinText(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'price-filter-error' : undefined}
          />
          <span className="text-muted-foreground" aria-hidden>
            –
          </span>
          <Input
            aria-label="Maximum price"
            inputMode="numeric"
            placeholder="Max"
            value={maxText}
            onChange={(event) => setMaxText(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'price-filter-error' : undefined}
          />
        </div>
        {error && (
          <p id="price-filter-error" role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" size="sm" className="mt-3 w-full">
          Apply price
        </Button>
      </fieldset>
    </form>
  );
}

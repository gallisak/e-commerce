import type { Category } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: Category[] | undefined;
  isLoading: boolean;
  value: string | null;
  onChange: (slug: string | null) => void;
}

export function CategoryFilter({ categories, isLoading, value, onChange }: CategoryFilterProps) {
  const options = [
    { slug: null, name: 'All categories', count: undefined },
    ...(categories ?? []).map((c) => ({ slug: c.slug, name: c.name, count: c.productsCount })),
  ];

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Category</legend>
      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {options.map((option) => {
            const active = option.slug === value;
            return (
              <li key={option.slug ?? 'all'}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(option.slug)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active ? 'bg-muted font-medium' : 'text-muted-foreground',
                  )}
                >
                  <span className="truncate">{option.name}</span>
                  {option.count !== undefined && (
                    <span className="text-xs tabular-nums">{option.count}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

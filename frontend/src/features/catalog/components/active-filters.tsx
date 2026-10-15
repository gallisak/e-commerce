import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Category } from '@/lib/api/types';
import { type CatalogFilters, hasActiveFilters } from '../catalog-params';

interface ActiveFiltersProps {
  filters: CatalogFilters;
  categories: Category[] | undefined;
  onChange: (patch: Partial<CatalogFilters>) => void;
}

function priceLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `₴${min}–₴${max}`;
  if (min !== null) return `From ₴${min}`;
  return `Up to ₴${max}`;
}

export function ActiveFilters({ filters, categories, onChange }: ActiveFiltersProps) {
  if (!hasActiveFilters(filters)) return null;

  const chips: { key: string; label: string; clear: Partial<CatalogFilters> }[] = [];
  if (filters.search) {
    chips.push({ key: 'search', label: `“${filters.search}”`, clear: { search: '' } });
  }
  if (filters.category) {
    const name = categories?.find((c) => c.slug === filters.category)?.name ?? filters.category;
    chips.push({ key: 'category', label: name, clear: { category: null } });
  }
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    chips.push({
      key: 'price',
      label: priceLabel(filters.minPrice, filters.maxPrice),
      clear: { minPrice: null, maxPrice: null },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <Button
          key={chip.key}
          variant="secondary"
          size="xs"
          onClick={() => onChange(chip.clear)}
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <XIcon data-icon="inline-end" />
        </Button>
      ))}
      <Button
        variant="link"
        size="xs"
        onClick={() => onChange({ search: '', category: null, minPrice: null, maxPrice: null })}
      >
        Clear all
      </Button>
    </div>
  );
}

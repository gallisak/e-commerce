import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProductSort } from '@/lib/api/types';
import { SORT_OPTIONS } from '../catalog-params';

interface SortSelectProps {
  value: ProductSort;
  onChange: (value: ProductSort) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select
      items={SORT_OPTIONS}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as ProductSort);
      }}
    >
      <SelectTrigger aria-label="Sort products" className="w-full sm:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

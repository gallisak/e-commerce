import type { ProductSort } from '@/lib/api/types';

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export const DEFAULT_SORT: ProductSort = 'newest';
export const MAX_PRICE_UAH = 1_000_000;
const MAX_SEARCH_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CatalogFilters {
  search: string;
  category: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  sort: ProductSort;
  page: number;
}

export const EMPTY_FILTERS: CatalogFilters = {
  search: '',
  category: null,
  minPrice: null,
  maxPrice: null,
  sort: DEFAULT_SORT,
  page: 1,
};

function parsePrice(value: string | null): number | null {
  if (value === null || !/^\d{1,7}$/.test(value)) return null;
  const price = Number(value);
  return price <= MAX_PRICE_UAH ? price : null;
}

export function parseCatalogParams(params: URLSearchParams): CatalogFilters {
  const category = params.get('category');
  const sort = params.get('sort');
  const page = Number(params.get('page'));
  let minPrice = parsePrice(params.get('minPrice'));
  let maxPrice = parsePrice(params.get('maxPrice'));
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    search: (params.get('q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
    category: category && SLUG_PATTERN.test(category) ? category : null,
    minPrice,
    maxPrice,
    sort: SORT_OPTIONS.some((option) => option.value === sort)
      ? (sort as ProductSort)
      : DEFAULT_SORT,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function toCatalogParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.minPrice !== null) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== null) params.set('maxPrice', String(filters.maxPrice));
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Boolean(
    filters.search || filters.category || filters.minPrice !== null || filters.maxPrice !== null,
  );
}

export function catalogHref(filters: Partial<CatalogFilters>): string {
  const query = toCatalogParams({ ...EMPTY_FILTERS, ...filters }).toString();
  return query ? `/?${query}` : '/';
}

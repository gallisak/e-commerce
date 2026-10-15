import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { type CatalogFilters, parseCatalogParams, toCatalogParams } from './catalog-params';

export function useCatalogFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseCatalogParams(searchParams), [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<CatalogFilters>, { replace = false }: { replace?: boolean } = {}) => {
      setSearchParams(
        (current) => {
          const base = parseCatalogParams(current);
          const next = { ...base, ...patch };
          if (!('page' in patch)) next.page = 1;
          return toCatalogParams(next);
        },
        { replace, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  return [filters, setFilters] as const;
}

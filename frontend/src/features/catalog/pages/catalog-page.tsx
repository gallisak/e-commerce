import { useQuery } from '@tanstack/react-query';
import { PackageSearchIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { pluralize } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import { categoriesQuery, PAGE_SIZE, productsQuery } from '../api';
import { catalogHref, hasActiveFilters } from '../catalog-params';
import { ActiveFilters } from '../components/active-filters';
import { CategoryFilter } from '../components/category-filter';
import { PriceFilter } from '../components/price-filter';
import { ProductCard, ProductCardSkeleton } from '../components/product-card';
import { SearchBox } from '../components/search-box';
import { SortSelect } from '../components/sort-select';
import { useCatalogFilters } from '../use-catalog-filters';

export function CatalogPage() {
  const [filters, setFilters] = useCatalogFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const categories = useQuery(categoriesQuery());

  const category = filters.category
    ? categories.data?.find((item) => item.slug === filters.category)
    : undefined;
  const unknownCategory = Boolean(filters.category && categories.isSuccess && !category);
  const waitingForCategory = Boolean(filters.category && categories.isPending);
  useDocumentTitle(category?.name ?? null);

  const products = useQuery({
    ...productsQuery({
      page: filters.page,
      search: filters.search || undefined,
      categoryId: category?.id,
      minPrice: filters.minPrice === null ? undefined : filters.minPrice * 100,
      maxPrice: filters.maxPrice === null ? undefined : filters.maxPrice * 100,
      sort: filters.sort,
    }),
    enabled: !waitingForCategory && !unknownCategory,
  });

  const meta = products.data?.meta;
  const filtered = hasActiveFilters(filters);
  const firstShown = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const lastShown = meta ? firstShown + (products.data?.items.length ?? 0) - 1 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{category?.name ?? 'Catalog'}</h1>
        <p className="text-sm text-muted-foreground">
          Browse products, add them to your cart and check out.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <Button
            variant="outline"
            className="w-full md:hidden"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontalIcon data-icon="inline-start" />
            {filtersOpen ? 'Hide filters' : 'Show filters'}
          </Button>
          <div
            id={filtersId}
            className={cn('mt-4 space-y-6 md:mt-0 md:block', filtersOpen ? 'block' : 'hidden')}
          >
            <CategoryFilter
              categories={categories.data}
              isLoading={categories.isPending}
              value={filters.category}
              onChange={(slug) => setFilters({ category: slug })}
            />
            <PriceFilter
              min={filters.minPrice}
              max={filters.maxPrice}
              onApply={(range) => setFilters(range)}
            />
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-4" aria-labelledby="catalog-results">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchBox
              value={filters.search}
              onSearch={(search) => setFilters({ search }, { replace: true })}
            />
            <SortSelect value={filters.sort} onChange={(sort) => setFilters({ sort })} />
          </div>

          <ActiveFilters filters={filters} categories={categories.data} onChange={setFilters} />

          <h2 id="catalog-results" className="sr-only">
            Products
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {meta && meta.total > 0
              ? `Showing ${firstShown}–${lastShown} of ${pluralize(meta.total, 'product')}`
              : ' '}
          </p>

          {unknownCategory ? (
            <EmptyState
              icon={PackageSearchIcon}
              title="Category not found"
              description="This category does not exist or has been removed."
            >
              <ButtonLink variant="outline" to={catalogHref({ ...filters, category: null })}>
                Show all categories
              </ButtonLink>
            </EmptyState>
          ) : products.isError && !products.data ? (
            <ErrorState
              error={products.error}
              title="Could not load products"
              onRetry={() => products.refetch()}
            />
          ) : !products.data ? (
            <ProductGridSkeleton />
          ) : products.data.items.length === 0 ? (
            <EmptyState
              icon={PackageSearchIcon}
              title={
                meta && meta.total > 0
                  ? 'This page is empty'
                  : filtered
                    ? 'No products match your filters'
                    : 'No products yet'
              }
              description={
                meta && meta.total > 0
                  ? 'There are fewer pages than this link expects.'
                  : filtered
                    ? 'Try a different search term, category or price range.'
                    : 'Products added by the store will appear here.'
              }
            >
              {meta && meta.total > 0 ? (
                <ButtonLink variant="outline" to={catalogHref({ ...filters, page: 1 })}>
                  Go to the first page
                </ButtonLink>
              ) : (
                filtered && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFilters({ search: '', category: null, minPrice: null, maxPrice: null })
                    }
                  >
                    Clear filters
                  </Button>
                )
              )}
            </EmptyState>
          ) : (
            <>
              {products.isError && (
                <ErrorState
                  error={products.error}
                  title="Could not refresh products"
                  onRetry={() => products.refetch()}
                />
              )}
              <ul
                aria-busy={products.isFetching}
                className={cn(
                  'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3',
                  products.isPlaceholderData && 'opacity-60 transition-opacity',
                )}
              >
                {products.data.items.map((product) => (
                  <li key={product.id} className="flex">
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
              {meta && (
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  hrefFor={(page) => catalogHref({ ...filters, page })}
                  label="Catalog pages"
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div role="status" aria-label="Loading products">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <li key={index}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}

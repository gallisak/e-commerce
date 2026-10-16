import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageSearchIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/button-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { catalogKeys, categoriesQuery } from '@/features/catalog/api';
import { ProductImage } from '@/features/catalog/components/product-image';
import { SearchBox } from '@/features/catalog/components/search-box';
import { StockBadge } from '@/features/catalog/components/stock-badge';
import { errorMessage } from '@/lib/api/errors';
import type { Product } from '@/lib/api/types';
import { formatPrice, pluralize } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { buildQuery, patchParams, readPage } from '@/lib/search-params';
import { useDocumentTitle } from '@/lib/use-document-title';
import { adminProductsApi, adminProductsQuery } from '../api';

const ALL = 'ALL';

export function AdminProductsPage() {
  useDocumentTitle('Products');
  const [params, setParams] = useSearchParams();
  const search = params.get('q')?.trim().slice(0, 100) ?? '';
  const rawCategory = params.get('category') ?? '';
  const categoryId = isUuid(rawCategory) ? rawCategory : undefined;
  const page = readPage(params.get('page'));

  const categories = useQuery(categoriesQuery());
  const products = useQuery(adminProductsQuery({ page, search: search || undefined, categoryId }));

  const href = (next: { q?: string; category?: string; page?: number }) =>
    buildQuery({ q: search, category: categoryId, page, ...next });

  const categoryItems = [
    { value: ALL, label: 'All categories' },
    ...(categories.data ?? []).map((category) => ({ value: category.id, label: category.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <ButtonLink to="/admin/products/new">
          <PlusIcon data-icon="inline-start" />
          New product
        </ButtonLink>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:max-w-sm sm:flex-1">
          <SearchBox
            id="admin-product-search"
            label="Search products"
            value={search}
            onSearch={(q) => setParams((prev) => patchParams(prev, { q, page: null }))}
          />
        </div>
        <Select
          items={categoryItems}
          value={categoryId ?? ALL}
          onValueChange={(value) =>
            setParams((prev) =>
              patchParams(prev, { category: value && value !== ALL ? value : null, page: null }),
            )
          }
        >
          <SelectTrigger aria-label="Filter by category" className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {products.isError && !products.data ? (
        <ErrorState
          error={products.error}
          title="Could not load products"
          onRetry={() => products.refetch()}
        />
      ) : !products.data ? (
        <div role="status" aria-label="Loading products" className="space-y-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-14 w-full" />
          ))}
        </div>
      ) : products.data.items.length === 0 && page > 1 ? (
        <EmptyState icon={PackageSearchIcon} title="This page is empty">
          <ButtonLink variant="outline" to={`/admin/products${href({ page: 1 })}`}>
            Go to the first page
          </ButtonLink>
        </EmptyState>
      ) : products.data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearchIcon}
          title={search || categoryId ? 'No products match the filters' : 'No products yet'}
        >
          {search || categoryId ? (
            <ButtonLink variant="outline" to="/admin/products">
              Clear filters
            </ButtonLink>
          ) : (
            <ButtonLink to="/admin/products/new">Create the first product</ButtonLink>
          )}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pluralize(products.data.meta.total, 'product')}
          </p>
          <div className="rounded-xl border" aria-busy={products.isPlaceholderData}>
            <Table aria-label="Products">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.data.items.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            label="Product pages"
            page={products.data.meta.page}
            totalPages={products.data.meta.totalPages}
            hrefFor={(target) => `/admin/products${href({ page: target })}`}
          />
        </>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => adminProductsApi.remove(product.id),
    onSuccess: async () => {
      toast.success(`“${product.name}” deleted`);
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <ProductImage src={product.imageUrl} alt="" className="size-10 shrink-0 rounded-md" />
          <Link
            to={`/admin/products/${product.id}/edit`}
            className="line-clamp-2 font-medium whitespace-normal hover:underline"
          >
            {product.name}
          </Link>
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {product.category.name}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatPrice(product.price)}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{product.stock}</span>
          {product.stock <= 5 && <StockBadge stock={product.stock} />}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <ButtonLink
            variant="ghost"
            size="icon-sm"
            to={`/admin/products/${product.id}/edit`}
            aria-label={`Edit ${product.name}`}
          >
            <PencilIcon />
          </ButtonLink>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${product.name}`}>
                <Trash2Icon />
              </Button>
            }
            title={`Delete “${product.name}”?`}
            description="The product disappears from the catalog and from carts. Past orders keep their copy of it."
            confirmLabel="Delete"
            pendingLabel="Deleting…"
            onConfirm={() => remove.mutateAsync()}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

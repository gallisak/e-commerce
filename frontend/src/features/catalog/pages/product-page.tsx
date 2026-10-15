import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, PackageXIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toApiError } from '@/lib/api/errors';
import { formatPrice } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { productQuery } from '../api';
import { catalogHref } from '../catalog-params';
import { ProductImage } from '../components/product-image';
import { StockBadge } from '../components/stock-badge';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ProductPage() {
  const { productId = '' } = useParams();
  const validId = UUID_PATTERN.test(productId);
  const product = useQuery({ ...productQuery(productId), enabled: validId });
  useDocumentTitle(product.data?.name ?? (validId ? null : 'Product not found'));

  const notFound =
    !validId || (product.isError && [400, 404].includes(toApiError(product.error).status));

  if (notFound) {
    return (
      <EmptyState
        icon={PackageXIcon}
        title="Product not found"
        description="It may have been removed from the catalog."
      >
        <ButtonLink variant="outline" to="/">
          Back to the catalog
        </ButtonLink>
      </EmptyState>
    );
  }

  if (product.isError) {
    return (
      <ErrorState
        error={product.error}
        title="Could not load the product"
        onRetry={() => product.refetch()}
      />
    );
  }

  if (!product.data) return <ProductPageSkeleton />;

  const { name, description, price, stock, imageUrl, category } = product.data;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link to="/" className="hover:text-foreground">
              Catalog
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRightIcon className="size-3.5" aria-hidden />
            <Link to={catalogHref({ category: category.slug })} className="hover:text-foreground">
              {category.name}
            </Link>
          </li>
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
            <span aria-current="page" className="max-w-[16rem] truncate text-foreground">
              {name}
            </span>
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductImage
          src={imageUrl}
          alt={name}
          eager
          className="aspect-square w-full rounded-xl border"
        />
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Link
              to={catalogHref({ category: category.slug })}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {category.name}
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-semibold tabular-nums">{formatPrice(price)}</p>
            <StockBadge stock={stock} />
          </div>
          {description ? (
            <p className="leading-relaxed whitespace-pre-line text-muted-foreground">
              {description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description provided.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductPageSkeleton() {
  return (
    <div role="status" aria-label="Loading product" className="space-y-6">
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, PackageXIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageLoader } from '@/components/feedback/page-loader';
import { productQuery } from '@/features/catalog/api';
import { toApiError } from '@/lib/api/errors';
import { isUuid } from '@/lib/ids';
import { useDocumentTitle } from '@/lib/use-document-title';
import { ProductForm } from '../components/product-form';

function BackLink() {
  return (
    <Link
      to="/admin/products"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeftIcon className="size-4" aria-hidden />
      Products
    </Link>
  );
}

export function NewProductPage() {
  useDocumentTitle('New product');
  return (
    <div className="space-y-6">
      <BackLink />
      <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
      <ProductForm />
    </div>
  );
}

export function EditProductPage() {
  const { productId = '' } = useParams();
  const validId = isUuid(productId);
  const product = useQuery({ ...productQuery(productId), enabled: validId, staleTime: 0 });
  useDocumentTitle(product.data ? `Edit ${product.data.name}` : 'Edit product');

  const notFound =
    !validId || (product.isError && [400, 404].includes(toApiError(product.error).status));

  let content;
  if (notFound) {
    content = (
      <EmptyState icon={PackageXIcon} title="Product not found">
        <ButtonLink variant="outline" to="/admin/products">
          Back to products
        </ButtonLink>
      </EmptyState>
    );
  } else if (product.isError && !product.data) {
    content = (
      <ErrorState
        error={product.error}
        title="Could not load the product"
        onRetry={() => product.refetch()}
      />
    );
  } else if (!product.data) {
    content = <PageLoader label="Loading the product…" />;
  } else {
    content = (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
        <ProductForm key={product.data.id} product={product.data} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />
      {content}
    </div>
  );
}

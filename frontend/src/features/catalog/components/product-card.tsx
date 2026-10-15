import { Link } from 'react-router';
import type { Product } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { ProductImage } from './product-image';
import { StockBadge } from './stock-badge';

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <ProductImage
        src={product.imageUrl}
        alt=""
        className="aspect-square transition-opacity group-hover:opacity-95"
      />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-xs text-muted-foreground">{product.category.name}</p>
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link
            to={`/products/${product.id}`}
            className="outline-none after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="font-semibold tabular-nums">{formatPrice(product.price)}</span>
          <StockBadge stock={product.stock} />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border" aria-hidden>
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="mt-2 flex justify-between">
          <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/5 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

import { AlertTriangleIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/features/catalog/components/product-image';
import type { CartItem } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { maxOrderable } from '../cart-math';
import { QuantityStepper } from './quantity-stepper';

interface CartLineProps {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartLine({ item, onQuantityChange, onRemove }: CartLineProps) {
  const href = `/products/${item.productId}`;
  const limit = maxOrderable(item.stock);

  return (
    <li className="flex gap-3 py-4 sm:gap-4" aria-label={item.name}>
      <Link to={href} tabIndex={-1} aria-hidden className="shrink-0">
        <ProductImage src={item.imageUrl} alt="" className="size-20 rounded-lg border sm:size-24" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={href} className="line-clamp-2 font-medium hover:underline">
              {item.name}
            </Link>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatPrice(item.price)} each
            </p>
          </div>
          <p className="shrink-0 font-semibold tabular-nums" aria-label="Line total">
            {formatPrice(item.lineTotal)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <QuantityStepper
            label={`Quantity of ${item.name}`}
            value={item.quantity}
            max={Math.max(limit, item.quantity)}
            disabled={item.issue === 'OUT_OF_STOCK'}
            onChange={onQuantityChange}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove()}
            aria-label={`Remove ${item.name}`}
            className="text-muted-foreground"
          >
            <Trash2Icon data-icon="inline-start" />
            Remove
          </Button>
        </div>
        {item.issue && (
          <p
            role="alert"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-destructive"
          >
            <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
            {item.issue === 'OUT_OF_STOCK' ? (
              'This product is out of stock. Remove it to place the order.'
            ) : (
              <>
                Only {item.stock} available.
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0"
                  onClick={() => onQuantityChange(limit)}
                >
                  Set quantity to {limit}
                </Button>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

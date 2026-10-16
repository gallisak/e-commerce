import { ShoppingCartIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/button-link';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { CartItem } from '@/lib/api/types';
import { formatPrice, pluralize } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { CartLine } from '../components/cart-line';
import { useCart, useCartMutation, useCartSyncing } from '../use-cart';

export function CartPage() {
  useDocumentTitle('Cart');
  const navigate = useNavigate();
  const cart = useCart();
  const mutation = useCartMutation();
  const syncing = useCartSyncing();

  if (cart.isError && !cart.data) {
    return (
      <ErrorState
        error={cart.error}
        title="Could not load your cart"
        onRetry={() => cart.refetch()}
      />
    );
  }

  if (!cart.data) return <CartSkeleton />;

  const { items, totalQuantity, totalAmount, hasIssues } = cart.data;

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
        <EmptyState
          icon={ShoppingCartIcon}
          title="Your cart is empty"
          description="Browse the catalog and add something you like."
        >
          <ButtonLink to="/">Go to the catalog</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  const remove = (item: CartItem) => {
    mutation.mutate({
      type: 'remove',
      productId: item.productId,
      onApplied: () =>
        toast(`Removed “${item.name}”`, {
          id: `removed-${item.productId}`,
          action: {
            label: 'Undo',
            onClick: () =>
              mutation.mutate({
                type: 'add',
                product: { ...item, id: item.productId },
                quantity: item.quantity,
              }),
          },
        }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Clear cart
            </Button>
          }
          title="Clear the cart?"
          description="All products will be removed from your cart."
          confirmLabel="Clear cart"
          cancelLabel="Keep items"
          onConfirm={() => mutation.mutate({ type: 'clear' })}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <ul aria-label="Cart items" className="divide-y rounded-xl border px-4">
          {items.map((item) => (
            <CartLine
              key={item.productId}
              item={item}
              onQuantityChange={(quantity) =>
                mutation.mutate({ type: 'update', productId: item.productId, quantity })
              }
              onRemove={() => remove(item)}
            />
          ))}
        </ul>

        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span className="tabular-nums">{pluralize(totalQuantity, 'item')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>Free</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums" aria-label="Cart total">
                {formatPrice(totalAmount)}
              </span>
            </div>
            {hasIssues && (
              <p className="text-destructive">
                Some items are not available in the requested quantity. Update them to continue.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              size="lg"
              className="w-full"
              disabled={hasIssues || syncing}
              onClick={() => navigate('/checkout')}
            >
              {syncing ? 'Saving the cart…' : 'Proceed to checkout'}
            </Button>
            <ButtonLink variant="ghost" size="sm" to="/" className="w-full">
              Continue shopping
            </ButtonLink>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div role="status" aria-label="Loading cart" className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4 rounded-xl border p-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="flex gap-4">
              <Skeleton className="size-24 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-7 w-28" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

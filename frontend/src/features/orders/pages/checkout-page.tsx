import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCardIcon, ShoppingCartIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FormError } from '@/components/form/form-error';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart, useCartSyncing } from '@/features/cart/use-cart';
import { toApiError } from '@/lib/api/errors';
import type { StockShortage } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { applyServerError } from '@/lib/forms';
import { createIdempotencyKey } from '@/lib/idempotency';
import { useDocumentTitle } from '@/lib/use-document-title';
import { StockShortages } from '../components/stock-shortages';
import { type CheckoutValues, checkoutSchema } from '../schemas';
import { readShortages } from '../shortages';
import { useCheckout } from '../use-orders';

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const navigate = useNavigate();
  const cart = useCart();
  const syncing = useCartSyncing();
  const checkout = useCheckout();
  const [idempotencyKey] = useState(createIdempotencyKey);
  const [shortages, setShortages] = useState<StockShortage[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { shippingAddress: '' },
  });

  const onSubmit = handleSubmit(async ({ shippingAddress }) => {
    setShortages([]);
    try {
      const order = await checkout.mutateAsync({ shippingAddress, idempotencyKey });
      toast.success('Order placed');
      navigate(`/account/orders/${order.id}`, { replace: true, state: { placed: true } });
    } catch (error) {
      const apiError = toApiError(error);
      const items = apiError.status === 409 ? readShortages(apiError.body) : [];
      if (items.length > 0) setShortages(items);
      else applyServerError(error, setError, ['shippingAddress']);
    }
  });

  if (cart.isError && !cart.data) {
    return (
      <ErrorState
        error={cart.error}
        title="Could not load your cart"
        onRetry={() => cart.refetch()}
      />
    );
  }

  if (!cart.data) {
    return (
      <div role="status" aria-label="Loading checkout" className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const { items, totalAmount, hasIssues } = cart.data;

  if (items.length === 0 && shortages.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCartIcon}
        title="Your cart is empty"
        description="Add products to the cart before checking out."
      >
        <ButtonLink to="/">Go to the catalog</ButtonLink>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <form noValidate onSubmit={onSubmit} className="space-y-6">
          {shortages.length > 0 && <StockShortages items={shortages} />}
          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FormError message={errors.root?.server?.message} />
                <TextField
                  id="checkout-address"
                  label="Shipping address"
                  placeholder="Street, building, apartment, city"
                  autoComplete="street-address"
                  description="We deliver anywhere in Ukraine. Shipping is free."
                  registration={register('shippingAddress')}
                  error={errors.shippingAddress}
                />
              </FieldGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <CreditCardIcon />
                <AlertDescription>
                  This store uses a simulated payment. No card details are needed: the payment is
                  processed in the background right after you place the order.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          {hasIssues && (
            <p className="text-sm text-destructive">
              Some items in your cart are not available in the requested quantity.{' '}
              <ButtonLink variant="link" size="xs" className="h-auto p-0" to="/cart">
                Update the cart
              </ButtonLink>
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={isSubmitting || syncing || hasIssues || items.length === 0}
          >
            {isSubmitting
              ? 'Placing the order…'
              : syncing
                ? 'Saving the cart…'
                : `Place order · ${formatPrice(totalAmount)}`}
          </Button>
        </form>

        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Your order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul aria-label="Order items" className="space-y-2">
              {items.map((item) => (
                <li key={item.productId} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="line-clamp-2">{item.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {item.quantity} × {formatPrice(item.price)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(totalAmount)}</span>
            </div>
            <ButtonLink variant="ghost" size="sm" to="/cart" className="w-full">
              Edit the cart
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { ShoppingCartIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/button-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { loginPath } from '@/features/auth/redirect';
import { useAuth } from '@/features/auth/use-auth';
import type { Product } from '@/lib/api/types';
import { findCartItem, maxOrderable } from '../cart-math';
import { useCart, useCartMutation } from '../use-cart';
import { QuantityStepper } from './quantity-stepper';

export function AddToCart({ product }: { product: Product }) {
  const { status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();
  const mutation = useCartMutation();
  const [quantity, setQuantity] = useState(1);

  if (product.stock <= 0) {
    return (
      <Button size="lg" disabled className="w-full sm:w-auto">
        Out of stock
      </Button>
    );
  }

  if (status === 'pending') return <Skeleton className="h-9 w-full sm:w-48" />;

  if (status === 'anonymous') {
    return (
      <ButtonLink size="lg" to={loginPath(location.pathname)} className="w-full sm:w-auto">
        Log in to buy
      </ButtonLink>
    );
  }

  const inCart = findCartItem(cart.data, product.id)?.quantity ?? 0;
  const available = maxOrderable(product.stock) - inCart;
  const selected = Math.min(quantity, Math.max(available, 1));

  const handleAdd = () => {
    mutation.mutate({
      type: 'add',
      product,
      quantity: selected,
      onApplied: () =>
        toast.success(`Added “${product.name}” to the cart`, {
          action: { label: 'View cart', onClick: () => navigate('/cart') },
        }),
    });
    setQuantity(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper
          label={`Quantity of ${product.name}`}
          value={selected}
          max={Math.max(available, 1)}
          disabled={available <= 0}
          onChange={setQuantity}
          className="h-9"
        />
        <Button size="lg" onClick={handleAdd} disabled={available <= 0}>
          <ShoppingCartIcon data-icon="inline-start" />
          Add to cart
        </Button>
      </div>
      {inCart > 0 && (
        <p className="text-sm text-muted-foreground">
          {available > 0
            ? `${inCart} already in your cart. `
            : 'All available units are already in your cart. '}
          <Link
            to="/cart"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            View cart
          </Link>
        </p>
      )}
    </div>
  );
}

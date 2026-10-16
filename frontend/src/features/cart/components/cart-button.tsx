import { ShoppingCartIcon } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCart } from '../use-cart';

export function CartButton() {
  const { data } = useCart();
  const count = data?.totalQuantity ?? 0;

  return (
    <Link
      to="/cart"
      aria-label={count > 0 ? `Cart, ${pluralize(count, 'item')}` : 'Cart'}
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative')}
    >
      <ShoppingCartIcon />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-semibold text-primary-foreground tabular-nums"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

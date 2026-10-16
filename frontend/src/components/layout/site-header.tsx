import { StoreIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/use-auth';
import { CartButton } from '@/features/cart/components/cart-button';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-2 py-1 text-sm transition-colors hover:text-foreground',
    isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
  );

export function SiteHeader() {
  const { status, user, isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <Link
          to="/"
          aria-label="Mini Marketplace home"
          className="flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap"
        >
          <StoreIcon className="size-5" aria-hidden />
          <span className="hidden sm:inline">Mini Marketplace</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Catalog
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {status === 'pending' && <Skeleton className="h-7 w-24" />}
          {status === 'anonymous' && (
            <>
              <ButtonLink variant="ghost" size="sm" to="/login">
                Log in
              </ButtonLink>
              <ButtonLink size="sm" to="/register">
                Sign up
              </ButtonLink>
            </>
          )}
          {status === 'authenticated' && user && (
            <>
              <CartButton />
              <UserMenu user={user} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

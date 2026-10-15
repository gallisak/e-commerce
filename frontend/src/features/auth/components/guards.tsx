import { ShieldAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { PageLoader } from '@/components/feedback/page-loader';
import { loginPath, REDIRECT_PARAM, safeRedirectPath } from '../redirect';
import { useAuth } from '../use-auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'pending') return <PageLoader label="Checking your session…" />;
  if (status === 'anonymous') {
    return <Navigate to={loginPath(`${location.pathname}${location.search}`)} replace />;
  }
  return children;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return <RequireAuth>{isAdmin ? children : <Forbidden />}</RequireAuth>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [params] = useSearchParams();

  if (status === 'pending') return <PageLoader label="Checking your session…" />;
  if (status === 'authenticated') {
    return <Navigate to={safeRedirectPath(params.get(REDIRECT_PARAM))} replace />;
  }
  return children;
}

function Forbidden() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <ShieldAlertIcon className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        This area is available to administrators only.
      </p>
      <ButtonLink to="/">Back to the store</ButtonLink>
    </div>
  );
}

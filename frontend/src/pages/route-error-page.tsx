import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundPage } from './not-found-page';

export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <div className="px-4 py-16">
      <ErrorState
        error={error}
        title="This page failed to load"
        onRetry={() => window.location.reload()}
      >
        <ButtonLink size="sm" variant="ghost" to="/">
          Go to the store
        </ButtonLink>
      </ErrorState>
    </div>
  );
}

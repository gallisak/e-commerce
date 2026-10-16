import { AlertCircleIcon, RotateCwIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toApiError } from '@/lib/api/errors';

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  children,
}: ErrorStateProps) {
  const apiError = toApiError(error);
  return (
    <Alert variant="destructive" className="mx-auto max-w-xl">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-none space-y-1">
          {apiError.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
        {apiError.requestId && (
          <p className="mt-2 text-xs">
            Reference: <code className="font-mono">{apiError.requestId}</code>
          </p>
        )}
        {(onRetry || children) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCwIcon data-icon="inline-start" />
                Try again
              </Button>
            )}
            {children}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toApiError } from './api/errors';

export const ROOT_ERROR = 'root.server' as const;

export function applyServerError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  const apiError = toApiError(error);

  if (apiError.status === 429) {
    const wait = apiError.retryAfterSeconds;
    setError(ROOT_ERROR, {
      message: wait
        ? `Too many attempts. Try again in ${wait} second${wait === 1 ? '' : 's'}.`
        : apiError.message,
    });
    return;
  }

  const unmatched: string[] = [];
  for (const message of apiError.messages) {
    const field = fields.find((name) => message.startsWith(`${name} `));
    if (apiError.status === 400 && field) {
      setError(field, { message: capitalize(message) });
    } else {
      unmatched.push(message);
    }
  }
  if (unmatched.length > 0) setError(ROOT_ERROR, { message: unmatched.join('. ') });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

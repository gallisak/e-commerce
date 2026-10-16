export function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'page' && Number(value) <= 1) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

export function patchParams(
  current: URLSearchParams,
  patch: Record<string, string | number | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '') next.delete(key);
    else next.set(key, String(value));
  }
  if (Number(next.get('page')) <= 1) next.delete('page');
  return next;
}

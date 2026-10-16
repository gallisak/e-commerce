export const REDIRECT_PARAM = 'redirect';

export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  try {
    const url = new URL(value, 'http://localhost');
    if (url.origin !== 'http://localhost') return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path.startsWith('//')) return fallback;
    return path.startsWith('/login') || path.startsWith('/register') ? fallback : path;
  } catch {
    return fallback;
  }
}

export function loginPath(returnTo: string): string {
  const target = safeRedirectPath(returnTo, '');
  return target && target !== '/'
    ? `/login?${REDIRECT_PARAM}=${encodeURIComponent(target)}`
    : '/login';
}

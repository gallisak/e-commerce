import { loginPath, safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['/account', '/account'],
    ['/products?page=2#top', '/products?page=2#top'],
  ])('keeps the internal path %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/login',
    '/register?redirect=/x',
    '/.//evil.example',
    '/a/..//evil.example',
  ])('falls back for %s', (input) => {
    expect(safeRedirectPath(input, '/home')).toBe('/home');
  });
});

describe('loginPath', () => {
  it('adds the return path only when it is useful', () => {
    expect(loginPath('/account?tab=orders')).toBe('/login?redirect=%2Faccount%3Ftab%3Dorders');
    expect(loginPath('/')).toBe('/login');
    expect(loginPath('//evil.example')).toBe('/login');
  });
});

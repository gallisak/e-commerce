import { buildQuery, patchParams, readPage } from './search-params';

describe('search params', () => {
  it('reads a sane page number', () => {
    expect(readPage('3')).toBe(3);
    expect(['0', '-1', '2.5', 'abc', '100000', null].map(readPage)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('builds a query without empty values or the first page', () => {
    expect(buildQuery({ q: 'tea', status: undefined, page: 1 })).toBe('?q=tea');
    expect(buildQuery({ page: 2 })).toBe('?page=2');
    expect(buildQuery({})).toBe('');
  });

  it('patches the current params without losing unrelated ones', () => {
    const current = new URLSearchParams('category=books&q=old&page=3');
    expect(patchParams(current, { q: 'new', page: null }).toString()).toBe('category=books&q=new');
    expect(patchParams(current, { category: '' }).toString()).toBe('q=old&page=3');
    expect(patchParams(current, { page: 1 }).toString()).toBe('category=books&q=old');
  });
});

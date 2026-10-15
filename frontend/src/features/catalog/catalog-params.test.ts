import { catalogHref, EMPTY_FILTERS, parseCatalogParams, toCatalogParams } from './catalog-params';

const parse = (query: string) => parseCatalogParams(new URLSearchParams(query));

describe('catalog URL params', () => {
  it('reads every filter from the query string', () => {
    expect(
      parse('q=%20phone%20&category=electronics&minPrice=100&maxPrice=5000&sort=price_desc&page=3'),
    ).toEqual({
      search: 'phone',
      category: 'electronics',
      minPrice: 100,
      maxPrice: 5000,
      sort: 'price_desc',
      page: 3,
    });
  });

  it('falls back to defaults for invalid values', () => {
    expect(parse('category=Bad%20Slug&minPrice=-5&maxPrice=abc&sort=random&page=0&q=')).toEqual(
      EMPTY_FILTERS,
    );
    expect(parse('page=2.5').page).toBe(1);
    expect(parse('maxPrice=99999999').maxPrice).toBeNull();
  });

  it('swaps a reversed price range', () => {
    expect(parse('minPrice=900&maxPrice=100')).toMatchObject({ minPrice: 100, maxPrice: 900 });
  });

  it('limits the search length', () => {
    expect(parse(`q=${'a'.repeat(150)}`).search).toHaveLength(100);
  });

  it('omits defaults when serialising and round-trips the rest', () => {
    expect(toCatalogParams(EMPTY_FILTERS).toString()).toBe('');
    const filters = { ...EMPTY_FILTERS, search: 'tea pot', category: 'home', page: 2 };
    expect(parseCatalogParams(toCatalogParams(filters))).toEqual(filters);
  });

  it('builds catalog links', () => {
    expect(catalogHref({})).toBe('/');
    expect(catalogHref({ category: 'books', page: 2 })).toBe('/?category=books&page=2');
  });
});

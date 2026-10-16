import { type ProductFormValues, productSchema } from './schemas';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

function values(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    name: 'Clean Code',
    description: '',
    price: '599',
    stock: '10',
    categoryId: CATEGORY_ID,
    image: { source: 'none', url: '', file: null, current: null },
    ...overrides,
  };
}

function issues(input: ProductFormValues) {
  const result = productSchema.safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

const image = (patch: Partial<ProductFormValues['image']>) =>
  values({ image: { ...values().image, ...patch } });

describe('productSchema', () => {
  it('accepts a valid product', () => {
    expect(issues(values())).toEqual({});
  });

  it('validates price, stock and category', () => {
    expect(issues(values({ price: '10000001', stock: '1.5', categoryId: '' }))).toEqual({
      price: 'Enter a price like 599 or 599.99',
      stock: 'Stock must be a whole number',
      categoryId: 'Choose a category',
    });
    expect(issues(values({ price: '1000000.01' })).price).toBe('Price must be at most ₴1,000,000');
    expect(issues(values({ stock: '1000001' })).stock).toBe('Stock must be at most 1,000,000');
  });

  it('rejects control characters in the name', () => {
    expect(issues(values({ name: 'Bad\nname' })).name).toBe('Name must be on one line');
  });

  it('requires a valid https URL for linked images', () => {
    expect(issues(image({ source: 'url' }))['image.url']).toBe('Enter an image URL');
    expect(issues(image({ source: 'url', url: 'javascript:alert(1)' }))['image.url']).toBe(
      'Enter a valid https:// URL',
    );
    expect(issues(image({ source: 'url', url: 'http://picsum.photos/600' }))['image.url']).toBe(
      'Enter a valid https:// URL',
    );
    expect(issues(image({ source: 'url', url: 'https://picsum.photos/600' }))).toEqual({});
  });

  it('requires a file unless an uploaded image is kept', () => {
    expect(issues(image({ source: 'file' }))['image.file']).toBe('Choose an image file');
    expect(
      issues(image({ source: 'file', current: 'https://cdn.example.com/a.jpg' }))['image.file'],
    ).toBe('Choose an image file');
    expect(issues(image({ source: 'file', current: '/uploads/products/a.png' }))).toEqual({});
  });

  it('checks the file type and size', () => {
    const text = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(issues(image({ source: 'file', file: text }))['image.file']).toBe(
      'Only JPEG, PNG and WebP images are allowed',
    );
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    expect(issues(image({ source: 'file', file: big }))['image.file']).toBe(
      'The image must be at most 5 MB',
    );
  });
});

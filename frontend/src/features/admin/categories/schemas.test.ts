import { categorySchema, toCategoryPayload } from './schemas';

describe('categorySchema', () => {
  it('trims values and allows an empty slug', () => {
    const result = categorySchema.parse({ name: '  Garden ', slug: '' });
    expect(toCategoryPayload(result)).toEqual({ name: 'Garden', slug: undefined });
  });

  it('validates the slug format', () => {
    expect(categorySchema.safeParse({ name: 'Garden', slug: 'garden-tools' }).success).toBe(true);
    for (const slug of ['Garden', 'garden tools', '-garden', 'garden--tools', 'сад']) {
      expect(categorySchema.safeParse({ name: 'Garden', slug }).success).toBe(false);
    }
  });
});

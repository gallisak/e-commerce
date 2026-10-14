import { slugify } from './slugify.js';

describe('slugify', () => {
  it.each([
    ['Electronics', 'electronics'],
    ["Men's Clothing", 'mens-clothing'],
    ['Home & Kitchen', 'home-kitchen'],
    ['  Hello, World!  ', 'hello-world'],
    ['Sports -- Outdoors', 'sports-outdoors'],
    ['Café crème', 'cafe-creme'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when there are no letters or digits', () => {
    expect(slugify('!!!')).toBe('');
  });
});

import { cart, cartItem, product } from '@/test/fixtures';
import {
  addToCart,
  EMPTY_CART,
  findCartItem,
  maxOrderable,
  removeFromCart,
  setCartQuantity,
} from './cart-math';

const book = cartItem({ quantity: 2 });
const phone = cartItem({
  productId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Nova X Smartphone',
  price: 1_899_900,
  stock: 3,
});

describe('cart math', () => {
  it('appends a new product with totals and stock issue', () => {
    const next = addToCart(EMPTY_CART, product({ stock: 1 }), 2);
    expect(next.items).toEqual([
      expect.objectContaining({ quantity: 2, lineTotal: 119_800, issue: 'INSUFFICIENT_STOCK' }),
    ]);
    expect(next).toMatchObject({ totalQuantity: 2, totalAmount: 119_800, hasIssues: true });
  });

  it('increments an existing line instead of duplicating it', () => {
    const next = addToCart(cart([book, phone]), product(), 3);
    expect(next.items.map((item) => item.quantity)).toEqual([5, 1]);
    expect(next.totalAmount).toBe(5 * 59_900 + 1_899_900);
  });

  it('sets the quantity and recomputes the issue', () => {
    const next = setCartQuantity(cart([book, phone]), phone.productId, 4);
    expect(findCartItem(next, phone.productId)).toMatchObject({
      quantity: 4,
      lineTotal: 4 * 1_899_900,
      issue: 'INSUFFICIENT_STOCK',
    });
    expect(next.totalQuantity).toBe(6);
    expect(setCartQuantity(next, phone.productId, 3).hasIssues).toBe(false);
  });

  it('removes a line and keeps the rest', () => {
    const next = removeFromCart(cart([book, phone]), book.productId);
    expect(next.items).toEqual([phone]);
    expect(next.totalAmount).toBe(1_899_900);
  });

  it('marks products without stock as out of stock', () => {
    expect(addToCart(EMPTY_CART, product({ stock: 0 }), 1).items[0].issue).toBe('OUT_OF_STOCK');
  });

  it('caps the orderable quantity by stock and the per-product limit', () => {
    expect(maxOrderable(5)).toBe(5);
    expect(maxOrderable(500)).toBe(99);
    expect(maxOrderable(-1)).toBe(0);
  });
});

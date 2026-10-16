import type { Cart, CartItem, CartItemIssue, Product } from '@/lib/api/types';

export const MAX_ITEM_QUANTITY = 99;

export const EMPTY_CART: Cart = { items: [], totalQuantity: 0, totalAmount: 0, hasIssues: false };

export type CartProduct = Pick<Product, 'id' | 'name' | 'price' | 'imageUrl' | 'stock'>;

export function maxOrderable(stock: number): number {
  return Math.max(0, Math.min(stock, MAX_ITEM_QUANTITY));
}

function issueFor(stock: number, quantity: number): CartItemIssue | null {
  if (stock <= 0) return 'OUT_OF_STOCK';
  return quantity > stock ? 'INSUFFICIENT_STOCK' : null;
}

function withQuantity(item: CartItem, quantity: number): CartItem {
  return {
    ...item,
    quantity,
    lineTotal: item.price * quantity,
    issue: issueFor(item.stock, quantity),
  };
}

function summarize(items: CartItem[]): Cart {
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
    hasIssues: items.some((item) => item.issue !== null),
  };
}

export function findCartItem(cart: Cart | undefined, productId: string): CartItem | undefined {
  return cart?.items.find((item) => item.productId === productId);
}

export function addToCart(cart: Cart, product: CartProduct, quantity: number): Cart {
  const existing = findCartItem(cart, product.id);
  if (existing) {
    return summarize(
      cart.items.map((item) =>
        item.productId === product.id ? withQuantity(item, item.quantity + quantity) : item,
      ),
    );
  }
  const item: CartItem = {
    productId: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    stock: product.stock,
    quantity,
    lineTotal: product.price * quantity,
    issue: issueFor(product.stock, quantity),
  };
  return summarize([...cart.items, item]);
}

export function setCartQuantity(cart: Cart, productId: string, quantity: number): Cart {
  return summarize(
    cart.items.map((item) => (item.productId === productId ? withQuantity(item, quantity) : item)),
  );
}

export function removeFromCart(cart: Cart, productId: string): Cart {
  return summarize(cart.items.filter((item) => item.productId !== productId));
}

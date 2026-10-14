import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Product } from '../generated/prisma/client.js';
import type { CartItemWithProduct, CartRepository } from './cart.repository.js';
import { CartService } from './cart.service.js';
import { CartItemIssue } from './dto/cart-response.dto.js';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Phone',
  description: '',
  price: 10_000,
  stock: 5,
  imageUrl: null,
  categoryId: 'c-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const item = (quantity: number, overrides: Partial<Product> = {}): CartItemWithProduct => {
  const p = product(overrides);
  return {
    id: `item-${p.id}`,
    cartId: 'cart-1',
    productId: p.id,
    quantity,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: p,
  };
};

describe('CartService', () => {
  let repository: Record<keyof CartRepository, ReturnType<typeof vi.fn>>;
  let service: CartService;

  beforeEach(() => {
    repository = {
      transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
      getOrCreateCartId: vi.fn().mockResolvedValue('cart-1'),
      findItems: vi.fn().mockResolvedValue([]),
      findActiveProduct: vi.fn().mockResolvedValue(product()),
      incrementItem: vi.fn().mockResolvedValue({ quantity: 1 }),
      hasItem: vi.fn().mockResolvedValue(true),
      setItemQuantity: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    service = new CartService(repository as unknown as CartRepository);
  });

  describe('getCart', () => {
    it('calculates line totals, totals and flags stock issues', async () => {
      repository.findItems.mockResolvedValue([
        item(2, { id: 'ok', price: 1_000, stock: 10 }),
        item(3, { id: 'short', price: 500, stock: 1 }),
        item(1, { id: 'gone', price: 200, stock: 0 }),
      ]);

      const cart = await service.getCart('u-1');

      expect(cart.items.map((i) => [i.productId, i.lineTotal, i.issue])).toEqual([
        ['ok', 2_000, null],
        ['short', 1_500, CartItemIssue.InsufficientStock],
        ['gone', 200, CartItemIssue.OutOfStock],
      ]);
      expect(cart).toMatchObject({ totalQuantity: 6, totalAmount: 3_700, hasIssues: true });
    });

    it('returns an empty cart for a user without items', async () => {
      await expect(service.getCart('u-1')).resolves.toEqual({
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
        hasIssues: false,
      });
    });
  });

  describe('addItem', () => {
    it('adds the quantity to the existing line', async () => {
      repository.incrementItem.mockResolvedValue({ quantity: 3 });
      await service.addItem('u-1', { productId: 'p-1', quantity: 2 });

      expect(repository.incrementItem).toHaveBeenCalledWith({}, 'cart-1', 'p-1', 2);
      expect(repository.findItems).toHaveBeenCalledWith('u-1');
    });

    it('rejects an unknown or deleted product with 404', async () => {
      repository.findActiveProduct.mockResolvedValue(null);
      await expect(service.addItem('u-1', { productId: 'x', quantity: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.incrementItem).not.toHaveBeenCalled();
    });

    it('rejects an out-of-stock product without touching the cart', async () => {
      repository.findActiveProduct.mockResolvedValue(product({ stock: 0 }));
      await expect(service.addItem('u-1', { productId: 'p-1', quantity: 1 })).rejects.toMatchObject(
        {
          response: { available: 0 },
        },
      );
      expect(repository.incrementItem).not.toHaveBeenCalled();
    });

    it('rolls back when the resulting quantity exceeds stock', async () => {
      repository.incrementItem.mockResolvedValue({ quantity: 6 });
      const error = await service.addItem('u-1', { productId: 'p-1', quantity: 2 }).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ productId: 'p-1', available: 5 });
      expect(repository.findItems).not.toHaveBeenCalled();
    });

    it('enforces the per-line maximum', async () => {
      repository.findActiveProduct.mockResolvedValue(product({ stock: 500 }));
      repository.incrementItem.mockResolvedValue({ quantity: 100 });
      await expect(
        service.addItem('u-1', { productId: 'p-1', quantity: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateItem', () => {
    it('sets the quantity within stock', async () => {
      await service.updateItem('u-1', 'p-1', 5);
      expect(repository.setItemQuantity).toHaveBeenCalledWith('u-1', 'p-1', 5);
    });

    it('rejects a quantity above stock', async () => {
      await expect(service.updateItem('u-1', 'p-1', 6)).rejects.toBeInstanceOf(ConflictException);
      expect(repository.setItemQuantity).not.toHaveBeenCalled();
    });

    it('returns 404 when the product is not in the cart, even if it is out of stock', async () => {
      repository.hasItem.mockResolvedValue(false);
      repository.findActiveProduct.mockResolvedValue(product({ stock: 0 }));
      await expect(service.updateItem('u-1', 'p-1', 1)).rejects.toThrow(
        'Product is not in the cart',
      );
      expect(repository.setItemQuantity).not.toHaveBeenCalled();
    });

    it('returns 404 for a deleted product', async () => {
      repository.findActiveProduct.mockResolvedValue(null);
      await expect(service.updateItem('u-1', 'p-1', 1)).rejects.toThrow('Product not found');
    });
  });

  it('removes a line idempotently and returns the cart', async () => {
    await expect(service.removeItem('u-1', 'p-1')).resolves.toMatchObject({ items: [] });
    expect(repository.removeItem).toHaveBeenCalledWith('u-1', 'p-1');
  });

  it('clears the cart', async () => {
    await service.clear('u-1');
    expect(repository.clear).toHaveBeenCalledWith('u-1');
  });
});

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Product } from '../generated/prisma/client.js';
import { MAX_CART_ITEM_QUANTITY } from './dto/add-cart-item.dto.js';
import type { AddCartItemDto } from './dto/add-cart-item.dto.js';
import {
  CartItemIssue,
  type CartItemResponseDto,
  type CartResponseDto,
} from './dto/cart-response.dto.js';
import { CartRepository, type CartItemWithProduct } from './cart.repository.js';

@Injectable()
export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  async getCart(userId: string): Promise<CartResponseDto> {
    return toCartResponse(await this.cartRepository.findItems(userId));
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartResponseDto> {
    const cartId = await this.cartRepository.getOrCreateCartId(userId);
    await this.cartRepository.transaction(async (tx) => {
      const product = await this.cartRepository.findActiveProduct(dto.productId, tx);
      if (!product) throw new NotFoundException('Product not found');
      if (product.stock === 0) throw outOfStock(product);

      const item = await this.cartRepository.incrementItem(tx, cartId, product.id, dto.quantity);
      assertQuantityAllowed(product, item.quantity);
    });
    return this.getCart(userId);
  }

  async updateItem(userId: string, productId: string, quantity: number): Promise<CartResponseDto> {
    const product = await this.cartRepository.findActiveProduct(productId);
    if (!product) throw new NotFoundException('Product not found');
    if (!(await this.cartRepository.hasItem(userId, productId))) {
      throw new NotFoundException('Product is not in the cart');
    }
    assertQuantityAllowed(product, quantity);

    await this.cartRepository.setItemQuantity(userId, productId, quantity);
    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string): Promise<CartResponseDto> {
    await this.cartRepository.removeItem(userId, productId);
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<CartResponseDto> {
    await this.cartRepository.clear(userId);
    return this.getCart(userId);
  }
}

function assertQuantityAllowed(product: Product, quantity: number): void {
  if (quantity > MAX_CART_ITEM_QUANTITY) {
    throw new ConflictException({
      message: `Maximum ${MAX_CART_ITEM_QUANTITY} units of one product per order`,
      productId: product.id,
      available: Math.min(product.stock, MAX_CART_ITEM_QUANTITY),
    });
  }
  if (product.stock === 0) throw outOfStock(product);
  if (quantity > product.stock) {
    throw new ConflictException({
      message: `Only ${product.stock} unit(s) of "${product.name}" available`,
      productId: product.id,
      available: product.stock,
    });
  }
}

function outOfStock(product: Product): ConflictException {
  return new ConflictException({
    message: `"${product.name}" is out of stock`,
    productId: product.id,
    available: 0,
  });
}

function toCartResponse(items: CartItemWithProduct[]): CartResponseDto {
  const mapped: CartItemResponseDto[] = items.map(({ product, quantity }) => ({
    productId: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    stock: product.stock,
    quantity,
    lineTotal: product.price * quantity,
    issue:
      product.stock === 0
        ? CartItemIssue.OutOfStock
        : quantity > product.stock
          ? CartItemIssue.InsufficientStock
          : null,
  }));

  return {
    items: mapped,
    totalQuantity: mapped.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: mapped.reduce((sum, item) => sum + item.lineTotal, 0),
    hasIssues: mapped.some((item) => item.issue !== null),
  };
}

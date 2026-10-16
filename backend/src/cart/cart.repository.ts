import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type Product } from '../generated/prisma/client.js';
import { isUniqueViolation } from '../common/filters/prisma-error.mapper.js';

export type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: { product: true } }>;

export type CartTransaction = Prisma.TransactionClient;

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: CartTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async getOrCreateCartId(userId: string): Promise<string> {
    const existing = await this.prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    if (existing) return existing.id;
    try {
      return (await this.prisma.cart.create({ data: { userId }, select: { id: true } })).id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return (
          await this.prisma.cart.findUniqueOrThrow({ where: { userId }, select: { id: true } })
        ).id;
      }
      throw error;
    }
  }

  findItems(userId: string): Promise<CartItemWithProduct[]> {
    return this.prisma.cartItem.findMany({
      where: { cart: { userId }, product: { deletedAt: null } },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findActiveProduct(productId: string, tx: CartTransaction = this.prisma): Promise<Product | null> {
    return tx.product.findFirst({ where: { id: productId, deletedAt: null } });
  }

  incrementItem(tx: CartTransaction, cartId: string, productId: string, quantity: number) {
    return tx.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  async hasItem(userId: string, productId: string): Promise<boolean> {
    return (await this.prisma.cartItem.count({ where: { productId, cart: { userId } } })) > 0;
  }

  async setItemQuantity(userId: string, productId: string, quantity: number): Promise<void> {
    await this.prisma.cartItem.updateMany({
      where: { productId, cart: { userId } },
      data: { quantity },
    });
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { productId, cart: { userId } } });
  }

  async clear(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  }
}

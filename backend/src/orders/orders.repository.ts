import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { OrderStatus, Prisma } from '../generated/prisma/client.js';

export type OrdersTransaction = Prisma.TransactionClient;

export const orderDetailsInclude = {
  items: { orderBy: { productName: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderDetailsInclude }>;

export const orderSummaryInclude = {
  _count: { select: { items: true } },
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.OrderInclude;

export type OrderSummary = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface ReservedProduct {
  id: string;
  name: string;
  price: number;
}

export interface NewOrderData {
  userId: string;
  shippingAddress: string;
  idempotencyKey: string | null;
  totalAmount: number;
  items: { productId: string; productName: string; unitPrice: number; quantity: number }[];
}

export interface OrderSearchParams {
  where: Prisma.OrderWhereInput;
  skip: number;
  take: number;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: OrdersTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { maxWait: 10_000, timeout: 15_000 });
  }

  async lockCart(tx: OrdersTransaction, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "carts" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;
  }

  async attachPayment(id: string, paymentId: string): Promise<void> {
    await this.prisma.order.updateMany({
      where: { id, paymentId: null },
      data: { paymentId },
    });
  }

  findCartLines(tx: OrdersTransaction, userId: string): Promise<CartLine[]> {
    return tx.cartItem.findMany({
      where: { cart: { userId } },
      select: { productId: true, quantity: true },
      orderBy: { productId: 'asc' },
    });
  }

  async reserveStock(
    tx: OrdersTransaction,
    productId: string,
    quantity: number,
  ): Promise<ReservedProduct | null> {
    const rows = await tx.$queryRaw<ReservedProduct[]>`
      UPDATE "products"
      SET "stock" = "stock" - ${quantity}, "updated_at" = now()
      WHERE "id" = ${productId}::uuid AND "deleted_at" IS NULL AND "stock" >= ${quantity}
      RETURNING "id", "name", "price"`;
    return rows[0] ?? null;
  }

  async releaseStock(tx: OrdersTransaction, items: CartLine[]): Promise<void> {
    const sorted = [...items].sort((a, b) =>
      a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
    );
    for (const { productId, quantity } of sorted) {
      await tx.$executeRaw`
        UPDATE "products"
        SET "stock" = "stock" + ${quantity}, "updated_at" = now()
        WHERE "id" = ${productId}::uuid`;
    }
  }

  findProductStock(tx: OrdersTransaction, productId: string) {
    return tx.product.findUnique({
      where: { id: productId },
      select: { name: true, stock: true, deletedAt: true },
    });
  }

  createOrder(tx: OrdersTransaction, data: NewOrderData): Promise<OrderWithDetails> {
    return tx.order.create({
      data: {
        userId: data.userId,
        shippingAddress: data.shippingAddress,
        idempotencyKey: data.idempotencyKey,
        totalAmount: data.totalAmount,
        items: { create: data.items },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.NEW,
            changedById: data.userId,
            note: 'Order placed',
          },
        },
      },
      include: orderDetailsInclude,
    });
  }

  async clearCart(tx: OrdersTransaction, userId: string): Promise<void> {
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
  }

  findById(id: string, tx: OrdersTransaction = this.prisma): Promise<OrderWithDetails | null> {
    return tx.order.findUnique({ where: { id }, include: orderDetailsInclude });
  }

  findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
    tx: OrdersTransaction = this.prisma,
  ): Promise<OrderWithDetails | null> {
    return tx.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: orderDetailsInclude,
    });
  }

  async search({ where, skip, take }: OrderSearchParams): Promise<[OrderSummary[], number]> {
    return this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: orderSummaryInclude,
      }),
      this.prisma.order.count({ where }),
    ]);
  }

  async updateStatusIfCurrent(
    tx: OrdersTransaction,
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    changes: { cancelReason: string | null; paymentId?: string },
  ): Promise<boolean> {
    const { count } = await tx.order.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        ...(to === OrderStatus.CANCELLED ? { cancelReason: changes.cancelReason } : {}),
        ...(changes.paymentId ? { paymentId: changes.paymentId } : {}),
      },
    });
    return count === 1;
  }

  async markRefunded(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, paymentId: { not: null }, refundedAt: null },
      data: { refundedAt: new Date() },
    });
    return count === 1;
  }

  async addStatusHistory(
    tx: OrdersTransaction,
    entry: {
      orderId: string;
      fromStatus: OrderStatus;
      toStatus: OrderStatus;
      changedById: string | null;
      note: string | null;
    },
  ): Promise<void> {
    await tx.orderStatusHistory.create({ data: entry });
  }

  async findPendingRefundIds(olderThan: Date, limit: number): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CANCELLED,
        paymentId: { not: null },
        refundedAt: null,
        updatedAt: { lt: olderThan },
      },
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    return orders.map((order) => order.id);
  }

  async findStaleNewOrderIds(olderThan: Date, limit: number): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.NEW, createdAt: { lt: olderThan } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return orders.map((order) => order.id);
  }
}

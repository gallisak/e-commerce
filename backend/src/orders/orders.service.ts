import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CatalogCacheService } from '../catalog-cache/catalog-cache.service.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { isCalendarDate, startOfLocalDay } from '../common/utils/dates.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { OrderStatus, Prisma } from '../generated/prisma/client.js';
import type { CheckoutDto } from './dto/checkout.dto.js';
import type { AdminOrderQueryDto, OrderQueryDto } from './dto/order-query.dto.js';
import {
  OrderDetailDto,
  type OrderListResponseDto,
  OrderSummaryDto,
} from './dto/order-response.dto.js';
import { canTransition, CUSTOMER_CANCELLABLE_STATUSES } from './order-status.js';
import {
  type OrdersTransaction,
  OrdersRepository,
  type OrderWithDetails,
  type ReservedProduct,
} from './orders.repository.js';
import { MockPaymentService } from './payment/mock-payment.service.js';
import { OrdersQueueService } from './queue/orders-queue.service.js';

export const MAX_ORDER_TOTAL = 2_147_483_647;

export interface StockShortage {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

export interface CheckoutResult {
  order: OrderDetailDto;
  replayed: boolean;
}

interface TransitionRequest {
  orderId: string;
  to: OrderStatus;
  actorId: string | null;
  note: string | null;
  expectedFrom?: readonly OrderStatus[];
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly timeZone: string;

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly ordersQueue: OrdersQueueService,
    private readonly payments: MockPaymentService,
    private readonly cache: CatalogCacheService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.timeZone = config.get('STORE_TIMEZONE', { infer: true });
  }

  async checkout(
    user: AuthUser,
    dto: CheckoutDto,
    idempotencyKey?: string,
  ): Promise<CheckoutResult> {
    if (idempotencyKey) {
      const existing = await this.ordersRepository.findByIdempotencyKey(user.id, idempotencyKey);
      if (existing) return { order: OrderDetailDto.fromEntity(existing), replayed: true };
    }

    let order: OrderWithDetails;
    try {
      order = await this.ordersRepository.transaction((tx) =>
        this.placeOrder(tx, user.id, dto.shippingAddress, idempotencyKey ?? null),
      );
    } catch (error) {
      if (idempotencyKey && isUniqueViolation(error)) {
        const existing = await this.ordersRepository.findByIdempotencyKey(user.id, idempotencyKey);
        if (existing) return { order: OrderDetailDto.fromEntity(existing), replayed: true };
      }
      throw error;
    }

    this.logger.log(
      `Order created: ${order.id} user=${user.id} items=${order.items.length} total=${order.totalAmount}`,
    );
    await this.cache.invalidate('stock reserved by order');
    await this.ordersQueue.enqueueProcessing(order.id);
    return { order: OrderDetailDto.fromEntity(order), replayed: false };
  }

  async findMine(userId: string, query: OrderQueryDto): Promise<OrderListResponseDto> {
    return this.search({ userId, status: query.status }, query.page, query.limit);
  }

  async findAll(query: AdminOrderQueryDto): Promise<OrderListResponseDto> {
    const from = this.dayStart('from', query.from);
    const to = this.dayStart('to', query.to);
    if (from && to && from >= to) {
      throw new BadRequestException('"from" must be earlier than "to"');
    }
    return this.search(
      {
        userId: query.userId,
        status: query.status,
        createdAt: from || to ? { gte: from, lt: to } : undefined,
      },
      query.page,
      query.limit,
    );
  }

  async findMineById(userId: string, orderId: string): Promise<OrderDetailDto> {
    return OrderDetailDto.fromEntity(await this.getOwnedOrThrow(userId, orderId));
  }

  async findById(orderId: string): Promise<OrderDetailDto> {
    return OrderDetailDto.fromEntity(await this.getOrThrow(orderId));
  }

  async cancelByCustomer(
    user: AuthUser,
    orderId: string,
    reason?: string,
  ): Promise<OrderDetailDto> {
    const order = await this.getOwnedOrThrow(user.id, orderId);
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
      throw new ConflictException(
        `Order in status ${order.status} can no longer be cancelled by the customer`,
      );
    }
    return OrderDetailDto.fromEntity(
      await this.transition({
        orderId,
        to: OrderStatus.CANCELLED,
        actorId: user.id,
        note: reason ?? 'Cancelled by customer',
        expectedFrom: CUSTOMER_CANCELLABLE_STATUSES,
      }),
    );
  }

  async changeStatusByAdmin(
    admin: AuthUser,
    orderId: string,
    to: OrderStatus,
    note?: string,
  ): Promise<OrderDetailDto> {
    await this.getOrThrow(orderId);
    return OrderDetailDto.fromEntity(
      await this.transition({
        orderId,
        to,
        actorId: admin.id,
        note: note ?? (to === OrderStatus.CANCELLED ? 'Cancelled by admin' : null),
      }),
    );
  }

  async processPayment(orderId: string): Promise<void> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      this.logger.warn(`Processing skipped, order not found: ${orderId}`);
      return;
    }
    if (order.status !== OrderStatus.NEW) {
      this.logger.log(`Processing skipped, order ${orderId} is already ${order.status}`);
      return;
    }

    const payment = await this.payments.charge(order.id, order.totalAmount);
    try {
      await this.transition(
        payment.success
          ? {
              orderId,
              to: OrderStatus.PROCESSING,
              actorId: null,
              note: `Payment captured (${payment.transactionId})`,
              expectedFrom: [OrderStatus.NEW],
            }
          : {
              orderId,
              to: OrderStatus.CANCELLED,
              actorId: null,
              note: payment.reason,
              expectedFrom: [OrderStatus.NEW],
            },
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn(`Order ${orderId} changed while processing payment: ${error.message}`);
        if (payment.success) await this.payments.refund(orderId, payment.transactionId);
        return;
      }
      throw error;
    }
  }

  private async placeOrder(
    tx: OrdersTransaction,
    userId: string,
    shippingAddress: string,
    idempotencyKey: string | null,
  ): Promise<OrderWithDetails> {
    const lines = await this.ordersRepository.findCartLines(tx, userId);
    if (lines.length === 0) throw new BadRequestException('Cart is empty');

    const reserved: { product: ReservedProduct; quantity: number }[] = [];
    const shortages: StockShortage[] = [];
    for (const line of lines) {
      const product = await this.ordersRepository.reserveStock(tx, line.productId, line.quantity);
      if (product) {
        reserved.push({ product, quantity: line.quantity });
        continue;
      }
      const current = await this.ordersRepository.findProductStock(tx, line.productId);
      shortages.push({
        productId: line.productId,
        name: current?.name ?? 'Unknown product',
        requested: line.quantity,
        available: current && !current.deletedAt ? current.stock : 0,
      });
    }

    if (shortages.length > 0) {
      this.logger.warn(
        `Checkout rejected for user ${userId}: insufficient stock for ${shortages.map((s) => s.productId).join(', ')}`,
      );
      throw new ConflictException({
        message: 'Some items are not available in the requested quantity',
        items: shortages,
      });
    }

    const totalAmount = reserved.reduce(
      (sum, { product, quantity }) => sum + product.price * quantity,
      0,
    );
    if (totalAmount > MAX_ORDER_TOTAL) {
      throw new BadRequestException('Order total exceeds the allowed maximum');
    }

    const order = await this.ordersRepository.createOrder(tx, {
      userId,
      shippingAddress,
      idempotencyKey,
      totalAmount,
      items: reserved.map(({ product, quantity }) => ({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity,
      })),
    });
    await this.ordersRepository.clearCart(tx, userId);
    return order;
  }

  private async transition(request: TransitionRequest): Promise<OrderWithDetails> {
    const { orderId, to, actorId, note, expectedFrom } = request;

    const { order, from } = await this.ordersRepository.transaction(async (tx) => {
      const current = await this.ordersRepository.findById(orderId, tx);
      if (!current) throw new NotFoundException('Order not found');

      const from = current.status;
      if (expectedFrom && !expectedFrom.includes(from)) {
        throw new ConflictException(`Order is already ${from}`);
      }
      if (!canTransition(from, to)) {
        throw new ConflictException(`Cannot change order status from ${from} to ${to}`);
      }

      const cancelReason = to === OrderStatus.CANCELLED ? note : null;
      if (
        !(await this.ordersRepository.updateStatusIfCurrent(tx, orderId, from, to, cancelReason))
      ) {
        throw new ConflictException('Order status was changed concurrently, please retry');
      }
      if (to === OrderStatus.CANCELLED) {
        await this.ordersRepository.releaseStock(tx, current.items);
      }
      await this.ordersRepository.addStatusHistory(tx, {
        orderId,
        fromStatus: from,
        toStatus: to,
        changedById: actorId,
        note,
      });

      const updated = await this.ordersRepository.findById(orderId, tx);
      return { order: updated!, from };
    });

    this.logger.log(
      `Order status changed: ${orderId} ${from} -> ${to} by ${actorId ?? 'system'}${note ? ` (${note})` : ''}`,
    );
    if (to === OrderStatus.CANCELLED) {
      await this.cache.invalidate('stock released by cancelled order');
    }
    return order;
  }

  private async search(
    where: Prisma.OrderWhereInput,
    page: number,
    limit: number,
  ): Promise<OrderListResponseDto> {
    const [orders, total] = await this.ordersRepository.search({
      where,
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: orders.map((order) => OrderSummaryDto.fromEntity(order)),
      meta: PaginationMetaDto.of(page, limit, total),
    };
  }

  private dayStart(name: string, date: string | undefined): Date | undefined {
    if (date === undefined) return undefined;
    if (!isCalendarDate(date))
      throw new BadRequestException(`${name} is not a valid calendar date`);
    return startOfLocalDay(date, this.timeZone);
  }

  private async getOrThrow(orderId: string): Promise<OrderWithDetails> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async getOwnedOrThrow(userId: string, orderId: string): Promise<OrderWithDetails> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    return order;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

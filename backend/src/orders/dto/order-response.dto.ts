import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';
import { OrderStatus } from '../../generated/prisma/client.js';
import type { OrderSummary, OrderWithDetails } from '../orders.repository.js';

export class OrderCustomerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;
}

export class OrderItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ description: 'Product name at the time of purchase' })
  productName: string;

  @ApiProperty({ description: 'Unit price in kopecks at the time of purchase' })
  unitPrice: number;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ description: 'In kopecks' })
  lineTotal: number;
}

export class OrderStatusHistoryDto {
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', nullable: true })
  fromStatus: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  toStatus: OrderStatus;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ description: 'False for system transitions (queue worker)' })
  byUser: boolean;

  @ApiProperty()
  createdAt: Date;
}

export enum PaymentStatus {
  Pending = 'PENDING',
  Paid = 'PAID',
  NotPaid = 'NOT_PAID',
  RefundPending = 'REFUND_PENDING',
  Refunded = 'REFUNDED',
}

export class OrderPaymentDto {
  @ApiProperty({
    enum: PaymentStatus,
    enumName: 'PaymentStatus',
    description:
      'PENDING: waiting for the queue; NOT_PAID: cancelled before payment; REFUND_PENDING: cancelled after payment, refund queued',
  })
  status: PaymentStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Mock payment transaction id' })
  transactionId: string | null;

  @ApiProperty({ type: Date, nullable: true })
  refundedAt: Date | null;

  static fromEntity(
    order: Pick<OrderWithDetails, 'status' | 'paymentId' | 'refundedAt'>,
  ): OrderPaymentDto {
    return {
      status: paymentStatus(order),
      transactionId: order.paymentId,
      refundedAt: order.refundedAt,
    };
  }
}

function paymentStatus({
  status,
  paymentId,
  refundedAt,
}: Pick<OrderWithDetails, 'status' | 'paymentId' | 'refundedAt'>): PaymentStatus {
  if (refundedAt) return PaymentStatus.Refunded;
  if (!paymentId) {
    return status === OrderStatus.NEW ? PaymentStatus.Pending : PaymentStatus.NotPaid;
  }
  return status === OrderStatus.CANCELLED ? PaymentStatus.RefundPending : PaymentStatus.Paid;
}

export class OrderSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  @ApiProperty({ description: 'In kopecks' })
  totalAmount: number;

  @ApiProperty()
  itemsCount: number;

  @ApiProperty({ type: OrderCustomerDto })
  customer: OrderCustomerDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(order: OrderSummary): OrderSummaryDto {
    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      itemsCount: order._count.items,
      customer: order.user,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export class OrderDetailDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  @ApiProperty({ description: 'In kopecks' })
  totalAmount: number;

  @ApiProperty()
  shippingAddress: string;

  @ApiProperty({ type: String, nullable: true })
  cancelReason: string | null;

  @ApiProperty({ type: OrderPaymentDto })
  payment: OrderPaymentDto;

  @ApiProperty({ type: OrderCustomerDto })
  customer: OrderCustomerDto;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ type: [OrderStatusHistoryDto] })
  statusHistory: OrderStatusHistoryDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(order: OrderWithDetails): OrderDetailDto {
    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      shippingAddress: order.shippingAddress,
      cancelReason: order.cancelReason,
      payment: OrderPaymentDto.fromEntity(order),
      customer: order.user,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.unitPrice * item.quantity,
      })),
      statusHistory: order.statusHistory.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
        byUser: entry.changedById !== null,
        createdAt: entry.createdAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderSummaryDto] })
  items: OrderSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

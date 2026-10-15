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

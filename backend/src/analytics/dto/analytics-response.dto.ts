import { ApiProperty } from '@nestjs/swagger';

export class PeriodDto {
  @ApiProperty({ example: '2026-09-16', description: 'Inclusive' })
  from: string;

  @ApiProperty({ example: '2026-10-16', description: 'Exclusive' })
  to: string;

  @ApiProperty({ example: 'Europe/Kyiv' })
  timeZone: string;
}

export class TopProductDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Units sold in the period' })
  quantity: number;

  @ApiProperty({ description: 'Revenue in kopecks' })
  revenue: number;
}

export class SalesSummaryDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ description: 'Revenue of paid orders (PROCESSING, SHIPPED, COMPLETED), kopecks' })
  revenue: number;

  @ApiProperty({ description: 'Number of paid orders' })
  ordersCount: number;

  @ApiProperty({ description: 'revenue / ordersCount, kopecks' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Units sold' })
  itemsSold: number;

  @ApiProperty({ description: 'Orders cancelled in the period (not included in revenue)' })
  cancelledCount: number;

  @ApiProperty({ type: [TopProductDto] })
  topProducts: TopProductDto[];
}

export class DailySalesDto {
  @ApiProperty({ example: '2026-10-15' })
  date: string;

  @ApiProperty({ description: 'Kopecks' })
  revenue: number;

  @ApiProperty()
  ordersCount: number;
}

export class SalesByDayDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: [DailySalesDto], description: 'One entry per day, zero-filled' })
  days: DailySalesDto[];
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/types/auth-user.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { AnalyticsRepository, type ReportCursor } from './analytics.repository.js';
import { formatMoney, toCsvRow } from './csv.js';
import { type DateRange, resolveRange } from './date-range.js';
import type { DateRangeQueryDto, SummaryQueryDto } from './dto/analytics-query.dto.js';
import type { PeriodDto, SalesByDayDto, SalesSummaryDto } from './dto/analytics-response.dto.js';

export const REPORT_BATCH_SIZE = 500;

export const REPORT_COLUMNS = [
  'order_id',
  'ordered_at',
  'status',
  'customer_email',
  'product_id',
  'product_name',
  'quantity',
  'unit_price_uah',
  'line_total_uah',
];

export interface SalesReport {
  fileName: string;
  rows: AsyncIterable<string>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly timeZone: string;

  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.timeZone = config.get('STORE_TIMEZONE', { infer: true });
  }

  async getSummary(query: SummaryQueryDto): Promise<SalesSummaryDto> {
    const range = resolveRange(query, this.timeZone);
    const [summary, topProducts] = await Promise.all([
      this.analyticsRepository.summary(range, this.timeZone),
      this.analyticsRepository.topProducts(range, this.timeZone, query.top),
    ]);

    return {
      period: this.period(range),
      revenue: summary.revenue,
      ordersCount: summary.ordersCount,
      averageOrderValue:
        summary.ordersCount > 0 ? Math.round(summary.revenue / summary.ordersCount) : 0,
      itemsSold: summary.itemsSold,
      cancelledCount: summary.cancelledCount,
      topProducts,
    };
  }

  async getSalesByDay(query: DateRangeQueryDto): Promise<SalesByDayDto> {
    const range = resolveRange(query, this.timeZone);
    return {
      period: this.period(range),
      days: await this.analyticsRepository.salesByDay(range, this.timeZone),
    };
  }

  exportSalesReport(query: DateRangeQueryDto, admin: AuthUser): SalesReport {
    const range = resolveRange(query, this.timeZone);
    this.logger.log(`Sales report exported by ${admin.id} for ${range.from}..${range.to}`);
    return {
      fileName: `sales-report_${range.from}_${range.to}.csv`,
      rows: this.reportRows(range),
    };
  }

  private async *reportRows(range: DateRange): AsyncGenerator<string> {
    yield `﻿${toCsvRow(REPORT_COLUMNS)}`;

    let cursor: ReportCursor | null = null;
    for (;;) {
      const batch = await this.analyticsRepository.reportBatch(
        range,
        this.timeZone,
        cursor,
        REPORT_BATCH_SIZE,
      );
      if (batch.length > 0) {
        yield batch
          .map((row) =>
            toCsvRow([
              row.orderId,
              row.orderedAt,
              row.status,
              row.customerEmail,
              row.productId,
              row.productName,
              row.quantity,
              formatMoney(row.unitPrice),
              formatMoney(row.unitPrice * row.quantity),
            ]),
          )
          .join('');
      }
      if (batch.length < REPORT_BATCH_SIZE) return;
      const last = batch[batch.length - 1];
      cursor = { createdAt: last.createdAt, itemId: last.itemId };
    }
  }

  private period(range: DateRange): PeriodDto {
    return { from: range.from, to: range.to, timeZone: this.timeZone };
  }
}

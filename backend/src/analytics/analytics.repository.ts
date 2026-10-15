import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { OrderStatus, Prisma } from '../generated/prisma/client.js';
import type { DateRange } from './date-range.js';

export const SALES_STATUSES = [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.COMPLETED];

const salesStatuses = Prisma.raw(SALES_STATUSES.map((status) => `'${status}'`).join(', '));

export interface SummaryRow {
  revenue: number;
  ordersCount: number;
  itemsSold: number;
  cancelledCount: number;
}

export interface TopProductRow {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DailyRow {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface ReportRow {
  orderId: string;
  orderedAt: string;
  status: OrderStatus;
  customerEmail: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  itemId: string;
  createdAt: Date;
}

export interface ReportCursor {
  createdAt: Date;
  itemId: string;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async summary(range: DateRange, timeZone: string): Promise<SummaryRow> {
    const [row] = await this.prisma.$queryRaw<SummaryRow[]>`
      WITH period_orders AS (
        SELECT o."id", o."status", o."total_amount"
        FROM "orders" o
        WHERE ${this.inPeriod(range, timeZone)}
      )
      SELECT
        COALESCE(SUM("total_amount") FILTER (WHERE "status" IN (${salesStatuses})), 0)::float8 AS "revenue",
        COUNT(*) FILTER (WHERE "status" IN (${salesStatuses}))::int AS "ordersCount",
        COUNT(*) FILTER (WHERE "status" = 'CANCELLED')::int AS "cancelledCount",
        COALESCE((
          SELECT SUM(oi."quantity")
          FROM "order_items" oi
          JOIN period_orders po ON po."id" = oi."order_id"
          WHERE po."status" IN (${salesStatuses})
        ), 0)::int AS "itemsSold"
      FROM period_orders`;
    return row;
  }

  topProducts(range: DateRange, timeZone: string, limit: number): Promise<TopProductRow[]> {
    return this.prisma.$queryRaw<TopProductRow[]>`
      SELECT
        oi."product_id" AS "productId",
        COALESCE(p."name", MAX(oi."product_name")) AS "name",
        SUM(oi."quantity")::int AS "quantity",
        SUM(oi."quantity" * oi."unit_price")::float8 AS "revenue"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."order_id"
      LEFT JOIN "products" p ON p."id" = oi."product_id"
      WHERE ${this.inPeriod(range, timeZone)} AND o."status" IN (${salesStatuses})
      GROUP BY oi."product_id", p."name"
      ORDER BY "quantity" DESC, "revenue" DESC, oi."product_id"
      LIMIT ${limit}`;
  }

  salesByDay(range: DateRange, timeZone: string): Promise<DailyRow[]> {
    return this.prisma.$queryRaw<DailyRow[]>`
      WITH days AS (
        SELECT generate_series(${range.from}::date, ${range.to}::date - 1, interval '1 day')::date AS "day"
      ),
      daily AS (
        SELECT
          (o."created_at" AT TIME ZONE ${timeZone})::date AS "day",
          SUM(o."total_amount") AS "revenue",
          COUNT(*) AS "ordersCount"
        FROM "orders" o
        WHERE ${this.inPeriod(range, timeZone)} AND o."status" IN (${salesStatuses})
        GROUP BY 1
      )
      SELECT
        to_char(d."day", 'YYYY-MM-DD') AS "date",
        COALESCE(daily."revenue", 0)::float8 AS "revenue",
        COALESCE(daily."ordersCount", 0)::int AS "ordersCount"
      FROM days d
      LEFT JOIN daily ON daily."day" = d."day"
      ORDER BY d."day"`;
  }

  reportBatch(
    range: DateRange,
    timeZone: string,
    after: ReportCursor | null,
    batchSize: number,
  ): Promise<ReportRow[]> {
    const cursor = after
      ? Prisma.sql`AND (o."created_at", oi."id") > (${after.createdAt}, ${after.itemId}::uuid)`
      : Prisma.empty;
    return this.prisma.$queryRaw<ReportRow[]>`
      SELECT
        o."id" AS "orderId",
        to_char(o."created_at" AT TIME ZONE ${timeZone}, 'YYYY-MM-DD HH24:MI') AS "orderedAt",
        o."status"::text AS "status",
        u."email" AS "customerEmail",
        oi."product_id" AS "productId",
        oi."product_name" AS "productName",
        oi."quantity" AS "quantity",
        oi."unit_price" AS "unitPrice",
        oi."id" AS "itemId",
        o."created_at" AS "createdAt"
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."order_id"
      JOIN "users" u ON u."id" = o."user_id"
      WHERE ${this.inPeriod(range, timeZone)} AND o."status" IN (${salesStatuses}) ${cursor}
      ORDER BY o."created_at", oi."id"
      LIMIT ${batchSize}`;
  }

  private inPeriod(range: DateRange, timeZone: string): Prisma.Sql {
    return Prisma.sql`o."created_at" >= (${range.from}::date)::timestamp AT TIME ZONE ${timeZone}
      AND o."created_at" < (${range.to}::date)::timestamp AT TIME ZONE ${timeZone}`;
  }
}

import type { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/types/auth-user.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { Role } from '../generated/prisma/client.js';
import type { AnalyticsRepository, ReportRow } from './analytics.repository.js';
import { AnalyticsService, REPORT_BATCH_SIZE, REPORT_COLUMNS } from './analytics.service.js';

const admin: AuthUser = { id: 'admin-1', email: 'a@example.com', role: Role.ADMIN };

const reportRow = (i: number): ReportRow => ({
  orderId: `order-${i}`,
  orderedAt: '2026-10-01 10:00',
  status: 'COMPLETED',
  customerEmail: 'c@example.com',
  productId: `product-${i}`,
  productName: i === 0 ? '=cmd|" /C calc"!A0' : `Product ${i}`,
  quantity: 2,
  unitPrice: 1_050,
  itemId: `item-${i}`,
  createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)),
});

describe('AnalyticsService', () => {
  let repo: Record<keyof AnalyticsRepository, ReturnType<typeof vi.fn>>;
  let service: AnalyticsService;

  beforeEach(() => {
    repo = {
      summary: vi
        .fn()
        .mockResolvedValue({ revenue: 30_000, ordersCount: 4, itemsSold: 9, cancelledCount: 1 }),
      topProducts: vi
        .fn()
        .mockResolvedValue([{ productId: 'p', name: 'P', quantity: 5, revenue: 10_000 }]),
      salesByDay: vi.fn().mockResolvedValue([]),
      reportBatch: vi.fn().mockResolvedValue([]),
    };
    service = new AnalyticsService(
      repo as unknown as AnalyticsRepository,
      { get: () => 'Europe/Kyiv' } as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  it('builds the summary with average order value and the requested top size', async () => {
    const summary = await service.getSummary({ from: '2026-10-01', to: '2026-10-08', top: 5 });

    expect(repo.topProducts).toHaveBeenCalledWith(
      { from: '2026-10-01', to: '2026-10-08', days: 7 },
      'Europe/Kyiv',
      5,
    );
    expect(summary).toMatchObject({
      period: { from: '2026-10-01', to: '2026-10-08', timeZone: 'Europe/Kyiv' },
      revenue: 30_000,
      ordersCount: 4,
      averageOrderValue: 7_500,
      itemsSold: 9,
      cancelledCount: 1,
    });
  });

  it('returns a zero average for a period without sales', async () => {
    repo.summary.mockResolvedValue({ revenue: 0, ordersCount: 0, itemsSold: 0, cancelledCount: 0 });
    expect((await service.getSummary({ top: 5 })).averageOrderValue).toBe(0);
  });

  it('streams the CSV report in keyset-paginated batches', async () => {
    const firstBatch = Array.from({ length: REPORT_BATCH_SIZE }, (_, i) => reportRow(i));
    repo.reportBatch.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce([reportRow(9999)]);

    const report = service.exportSalesReport({ from: '2026-10-01', to: '2026-10-08' }, admin);
    let csv = '';
    for await (const chunk of report.rows) csv += chunk;

    expect(report.fileName).toBe('sales-report_2026-10-01_2026-10-08.csv');
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(`﻿${REPORT_COLUMNS.join(',')}`);
    expect(lines).toHaveLength(1 + REPORT_BATCH_SIZE + 1);
    expect(lines[1]).toContain(`,"'=cmd|"" /C calc""!A0",2,10.50,21.00`);
    expect(repo.reportBatch).toHaveBeenCalledTimes(2);
    expect(repo.reportBatch.mock.calls[1][2]).toEqual({
      createdAt: firstBatch.at(-1)!.createdAt,
      itemId: firstBatch.at(-1)!.itemId,
    });
  });

  it('produces only the header for an empty period', async () => {
    const report = service.exportSalesReport({ from: '2020-01-01', to: '2020-01-02' }, admin);
    const chunks: string[] = [];
    for await (const chunk of report.rows) chunks.push(chunk);
    expect(chunks).toEqual([`﻿${REPORT_COLUMNS.join(',')}\r\n`]);
    expect(repo.reportBatch).toHaveBeenCalledTimes(1);
  });
});

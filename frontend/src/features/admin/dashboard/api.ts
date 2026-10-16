import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { addDays } from '@/lib/dates';
import { adminKeys } from '../orders/api';

export interface DateRange {
  from?: string;
  to?: string;
}

export interface Period {
  from: string;
  to: string;
  timeZone: string;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface SalesSummary {
  period: Period;
  revenue: number;
  ordersCount: number;
  averageOrderValue: number;
  itemsSold: number;
  cancelledCount: number;
  topProducts: TopProduct[];
}

export interface DailySales {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface SalesByDay {
  period: Period;
  days: DailySales[];
}

export const TOP_PRODUCTS = 5;

function toApiRange({ from, to }: DateRange) {
  return { from, to: to ? addDays(to, 1) : undefined };
}

export const analyticsApi = {
  async summary(range: DateRange, signal?: AbortSignal): Promise<SalesSummary> {
    const { data } = await api.get<SalesSummary>('/admin/analytics/summary', {
      params: { ...toApiRange(range), top: TOP_PRODUCTS },
      signal,
    });
    return data;
  },

  async salesByDay(range: DateRange, signal?: AbortSignal): Promise<SalesByDay> {
    const { data } = await api.get<SalesByDay>('/admin/analytics/sales-by-day', {
      params: toApiRange(range),
      signal,
    });
    return data;
  },

  async salesReport(range: DateRange): Promise<{ blob: Blob; fileName: string }> {
    const response = await api.get<Blob>('/admin/analytics/sales-report.csv', {
      params: toApiRange(range),
      responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] ?? '');
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'sales-report.csv';
    return { blob: response.data, fileName };
  },
};

export const summaryQuery = (range: DateRange) =>
  queryOptions({
    queryKey: [...adminKeys.analytics(), 'summary', range] as const,
    queryFn: ({ signal }) => analyticsApi.summary(range, signal),
    placeholderData: keepPreviousData,
  });

export const salesByDayQuery = (range: DateRange) =>
  queryOptions({
    queryKey: [...adminKeys.analytics(), 'sales-by-day', range] as const,
    queryFn: ({ signal }) => analyticsApi.salesByDay(range, signal),
    placeholderData: keepPreviousData,
  });

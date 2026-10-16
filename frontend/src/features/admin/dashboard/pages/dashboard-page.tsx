import { useQuery } from '@tanstack/react-query';
import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/errors';
import { addDays, formatDay } from '@/lib/dates';
import { buildQuery } from '@/lib/search-params';
import { useDocumentTitle } from '@/lib/use-document-title';
import { analyticsApi, type DateRange, type Period, salesByDayQuery, summaryQuery } from '../api';
import { KpiCards } from '../components/kpi-cards';
import { RangePicker } from '../components/range-picker';
import { SalesChart } from '../components/sales-chart';
import { TopProducts } from '../components/top-products';
import { readRange } from '../range';

function describePeriod(period?: Period): string {
  if (!period) return 'Loading the period…';
  return `${formatDay(period.from)} – ${formatDay(addDays(period.to, -1))} (${period.timeZone})`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const [params, setParams] = useSearchParams();
  const range = readRange(params);
  const summary = useQuery(summaryQuery(range));
  const daily = useQuery(salesByDayQuery(range));
  const [exporting, setExporting] = useState(false);

  const period = summary.data?.period;
  const shownRange: DateRange =
    range.from || !period ? range : { from: period.from, to: addDays(period.to, -1) };

  const changeRange = (next: DateRange) => setParams(new URLSearchParams(buildQuery({ ...next })));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, fileName: serverName } = await analyticsApi.salesReport(range);
      const { from, to } = shownRange;
      const fileName = from && to ? `sales-report_${from}_${to}.csv` : serverName;
      downloadBlob(blob, fileName);
      toast.success(`Downloaded ${fileName}`);
    } catch (error) {
      toast.error(`Could not export the report: ${errorMessage(error)}`);
    } finally {
      setExporting(false);
    }
  };

  const error =
    summary.isError && !summary.data
      ? summary.error
      : daily.isError && !daily.data
        ? daily.error
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {describePeriod(summary.data?.period)}
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting}>
          <DownloadIcon data-icon="inline-start" />
          {exporting ? 'Preparing…' : 'Export CSV'}
        </Button>
      </div>

      <RangePicker
        key={`${range.from ?? ''}:${range.to ?? ''}`}
        range={range}
        initial={shownRange}
        onChange={changeRange}
      />

      {error ? (
        <ErrorState
          error={error}
          title="Could not load analytics"
          onRetry={() => {
            void summary.refetch();
            void daily.refetch();
          }}
        />
      ) : (
        <div className="space-y-6" aria-busy={summary.isFetching || daily.isFetching}>
          <KpiCards summary={summary.data} />
          <div className="grid items-start gap-6 xl:grid-cols-[1fr_24rem]">
            <Card>
              <CardHeader>
                <CardTitle>Sales by day</CardTitle>
                <CardDescription>Revenue of paid orders</CardDescription>
              </CardHeader>
              <CardContent>
                {daily.data ? (
                  <SalesChart days={daily.data.days} />
                ) : (
                  <Skeleton className="h-64 w-full" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top products</CardTitle>
                <CardDescription>By units sold</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.data ? (
                  <TopProducts products={summary.data.topProducts} />
                ) : (
                  <Skeleton className="h-48 w-full" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/format';
import type { SalesSummary } from '../api';

const NUMBER = new Intl.NumberFormat('en-US');

export function KpiCards({ summary }: { summary?: SalesSummary }) {
  const items = [
    {
      label: 'Revenue',
      value: summary && formatPrice(summary.revenue),
      hint: 'Paid orders only',
    },
    { label: 'Orders', value: summary && NUMBER.format(summary.ordersCount), hint: 'Paid' },
    {
      label: 'Average order',
      value: summary && formatPrice(summary.averageOrderValue),
      hint: 'Revenue / orders',
    },
    { label: 'Items sold', value: summary && NUMBER.format(summary.itemsSold), hint: 'Units' },
    {
      label: 'Cancelled',
      value: summary && NUMBER.format(summary.cancelledCount),
      hint: 'Not in revenue',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} size="sm" role="group" aria-label={item.label} className="gap-1">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {item.value ?? <Skeleton className="h-7 w-24" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{item.hint}</CardContent>
        </Card>
      ))}
    </div>
  );
}

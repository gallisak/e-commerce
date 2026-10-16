import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { formatDay } from '@/lib/dates';
import { formatPrice, pluralize } from '@/lib/format';
import type { DailySales } from '../api';

const chartConfig = {
  revenue: { label: 'Revenue', color: 'var(--primary)' },
} satisfies ChartConfig;

const compactCurrency = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function SalesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DailySales }[];
}) {
  const day = active ? payload?.[0]?.payload : undefined;
  if (!day) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{formatDay(day.date)}</p>
      <p className="tabular-nums">{formatPrice(day.revenue)}</p>
      <p className="text-muted-foreground">{pluralize(day.ordersCount, 'order')}</p>
    </div>
  );
}

export function SalesChart({ days }: { days: DailySales[] }) {
  const total = days.reduce((sum, day) => sum + day.revenue, 0);
  const best = days.reduce<DailySales | null>(
    (top, day) => (!top || day.revenue > top.revenue ? day : top),
    null,
  );
  const description =
    days.length === 0
      ? 'No data'
      : `Revenue by day from ${formatDay(days[0].date)} to ${formatDay(days.at(-1)!.date)}: total ${formatPrice(total)}${best && best.revenue > 0 ? `, best day ${formatDay(best.date)} with ${formatPrice(best.revenue)}` : ''}.`;

  return (
    <figure className="space-y-2">
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" aria-hidden>
        <BarChart data={days} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(value: string) => formatDay(value, 'short')}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => `₴${compactCurrency.format(value / 100)}`}
          />
          <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<SalesTooltip />} />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">{description}</figcaption>
      <table className="sr-only">
        <caption>Revenue by day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Revenue</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatDay(day.date)}</th>
              <td>{formatPrice(day.revenue)}</td>
              <td>{day.ordersCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

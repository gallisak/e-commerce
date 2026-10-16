import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addDays } from '@/lib/dates';
import type { DailySales, SalesSummary } from '../api';
import { KpiCards } from './kpi-cards';
import { SalesChart } from './sales-chart';
import { TopProducts } from './top-products';

const days: DailySales[] = Array.from({ length: 30 }, (_, index) => {
  const ordersCount = (index * 7) % 5;
  return {
    date: addDays('2026-09-17', index),
    ordersCount,
    revenue: ordersCount * (1_200_000 + ((index * 389_000) % 2_400_000)),
  };
});

const summary: SalesSummary = {
  period: { from: '2026-09-17', to: '2026-10-17', timeZone: 'Europe/Kyiv' },
  revenue: 182_313_400,
  ordersCount: 71,
  averageOrderValue: 2_567_794,
  itemsSold: 266,
  cancelledCount: 7,
  topProducts: [
    { productId: 'p1', name: 'Nova X Smartphone', quantity: 29, revenue: 55_097_100 },
    { productId: 'p2', name: 'ProBook 14 Laptop', quantity: 15, revenue: 52_498_500 },
    { productId: 'p3', name: 'View 27 QHD Monitor', quantity: 15, revenue: 16_498_500 },
    { productId: 'p4', name: 'Pulse 3 Smartwatch', quantity: 14, revenue: 7_698_600 },
    { productId: 'p5', name: 'Ribbed Beanie', quantity: 13, revenue: 518_700 },
  ],
};

const meta = {
  title: 'Admin/Dashboard',
  component: KpiCards,
  args: { summary },
} satisfies Meta<typeof KpiCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyFigures: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('group', { name: 'Revenue' })).toHaveTextContent(
      '₴1,823,134.00',
    );
  },
};

export const KeyFiguresLoading: Story = { args: { summary: undefined } };

export const SalesByDay: Story = {
  render: () => (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Sales by day</CardTitle>
      </CardHeader>
      <CardContent>
        <SalesChart days={days} />
      </CardContent>
    </Card>
  ),
};

export const NoSales: Story = {
  render: () => (
    <Card className="max-w-3xl">
      <CardContent className="space-y-4">
        <SalesChart days={days.map((day) => ({ ...day, revenue: 0, ordersCount: 0 }))} />
        <TopProducts products={[]} />
      </CardContent>
    </Card>
  ),
};

export const TopFive: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardContent>
        <TopProducts products={summary.topProducts} />
      </CardContent>
    </Card>
  ),
};

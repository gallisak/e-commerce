import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InternalAxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router';
import { errorBody, mockApi, type MockReply } from '@/test/http';
import { admin, authValue, renderRoutes } from '@/test/render';
import type { SalesByDay, SalesSummary } from '../api';
import { presetRange } from '../range';
import { DashboardPage } from './dashboard-page';

function SearchProbe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const routes = [
  { path: '/admin', element: [<DashboardPage key="page" />, <SearchProbe key="probe" />] },
];

const period = { from: '2026-09-17', to: '2026-10-17', timeZone: 'Europe/Kyiv' };

const summary: SalesSummary = {
  period,
  revenue: 182_313_400,
  ordersCount: 71,
  averageOrderValue: 2_567_794,
  itemsSold: 266,
  cancelledCount: 7,
  topProducts: [
    { productId: 'p1', name: 'Nova X Smartphone', quantity: 29, revenue: 55_097_100 },
    { productId: 'p2', name: 'ProBook 14 Laptop', quantity: 15, revenue: 52_498_500 },
  ],
};

const daily: SalesByDay = {
  period,
  days: [
    { date: '2026-10-15', revenue: 1_000_000, ordersCount: 2 },
    { date: '2026-10-16', revenue: 0, ordersCount: 0 },
  ],
};

function setup(
  path = '/admin',
  onReport: (config: InternalAxiosRequestConfig) => MockReply = () => ({
    status: 200,
    data: new Blob(['﻿order_id\n'], { type: 'text/csv' }),
    headers: {
      'content-disposition': 'attachment; filename="sales-report_2026-09-17_2026-10-17.csv"',
    },
  }),
) {
  const mock = mockApi((config) => {
    if (config.url?.endsWith('/summary')) return { status: 200, data: summary };
    if (config.url?.endsWith('/sales-by-day')) return { status: 200, data: daily };
    return onReport(config);
  });
  renderRoutes(routes, { path, auth: authValue({ user: admin }) });
  const callsTo = (suffix: string) => mock.calls.filter((call) => call.url?.endsWith(suffix));
  return { mock, callsTo };
}

describe('DashboardPage', () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    vi.restoreAllMocks();
  });

  it('shows key figures, the period and top products', async () => {
    restore = setup().mock.restore;

    expect(await screen.findByText('₴1,823,134.00')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Orders' })).toHaveTextContent('71');
    expect(screen.getByRole('group', { name: 'Average order' })).toHaveTextContent('₴25,677.94');
    expect(screen.getByRole('group', { name: 'Items sold' })).toHaveTextContent('266');
    expect(screen.getByRole('group', { name: 'Cancelled' })).toHaveTextContent('7');
    expect(screen.getByText('17 Sept 2026 – 16 Oct 2026 (Europe/Kyiv)')).toBeInTheDocument();

    const top = screen.getByRole('table', { name: 'Top products' });
    const rows = within(top).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole('link', { name: 'Nova X Smartphone' })).toHaveAttribute(
      'href',
      '/admin/products/p1/edit',
    );
    expect(rows[1]).toHaveTextContent('29');
  });

  it('describes the chart for screen readers', async () => {
    restore = setup().mock.restore;

    const chart = await screen.findByRole('figure');
    expect(chart.querySelector('figcaption')).toHaveTextContent(
      'Revenue by day from 15 Oct 2026 to 16 Oct 2026: total ₴10,000.00, best day 15 Oct 2026 with ₴10,000.00.',
    );
    expect(chart.querySelector('[data-slot="chart"]')).toHaveAttribute('aria-hidden', 'true');
    const data = screen.getByRole('table', { name: 'Revenue by day' });
    expect(within(data).getAllByRole('row')).toHaveLength(3);
    expect(data).toHaveTextContent('15 Oct 2026₴10,000.002');
  });

  it('prefills the dates with the default period', async () => {
    restore = setup().mock.restore;
    await screen.findByText('₴1,823,134.00');
    await waitFor(() => expect(screen.getByLabelText('From')).toHaveValue('2026-09-17'));
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-16');
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches presets through the URL', async () => {
    const { mock, callsTo } = setup();
    restore = mock.restore;
    await screen.findByText('₴1,823,134.00');

    await userEvent.click(screen.getByRole('button', { name: '7 days' }));

    const { from, to } = presetRange(7);
    expect(screen.getByTestId('search')).toHaveTextContent(`?from=${from}&to=${to}`);
    await waitFor(() => expect(callsTo('/summary').at(-1)?.params).toMatchObject({ from, top: 5 }));
    expect(callsTo('/sales-by-day').at(-1)?.params.to).not.toBe(to);
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies a valid custom period and rejects an invalid one', async () => {
    const { mock, callsTo } = setup();
    restore = mock.restore;
    await screen.findByText('₴1,823,134.00');

    const fromInput = screen.getByLabelText('From');
    const toInput = screen.getByLabelText('To');
    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, '2026-10-10');
    await userEvent.clear(toInput);
    await userEvent.type(toInput, '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The start date must not be after the end date',
    );

    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, '2026-09-25');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByTestId('search')).toHaveTextContent('?from=2026-09-25&to=2026-10-01');
    await waitFor(() =>
      expect(callsTo('/sales-by-day').at(-1)?.params).toEqual({
        from: '2026-09-25',
        to: '2026-10-02',
      }),
    );
  });

  it('exports the CSV report for the shown period', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(`${this.download} ${this.href}`);
    });
    const { mock, callsTo } = setup('/admin?from=2026-10-01&to=2026-10-10');
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));

    expect(
      await screen.findByText('Downloaded sales-report_2026-10-01_2026-10-10.csv'),
    ).toBeInTheDocument();
    expect(downloads).toEqual(['sales-report_2026-10-01_2026-10-10.csv blob:report']);
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(callsTo('.csv')[0]).toMatchObject({
      responseType: 'blob',
      params: { from: '2026-10-01', to: '2026-10-11' },
    });
  });

  it('explains why the export failed', async () => {
    const { mock } = setup('/admin', () => ({
      status: 400,
      data: new Blob([JSON.stringify(errorBody(400, 'Date range must not exceed 366 days'))], {
        type: 'application/json',
      }),
    }));
    restore = mock.restore;

    await userEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));

    expect(
      await screen.findByText('Could not export the report: Date range must not exceed 366 days'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  });

  it('shows an error with retry when analytics fail', async () => {
    restore = mockApi(() => ({ status: 500, data: errorBody(500, 'boom') })).restore;
    renderRoutes(routes, { path: '/admin', auth: authValue({ user: admin }) });
    expect(await screen.findByText('Could not load analytics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows an empty top list when nothing was sold', async () => {
    const mock = mockApi((config) =>
      config.url?.endsWith('/summary')
        ? { status: 200, data: { ...summary, revenue: 0, ordersCount: 0, topProducts: [] } }
        : { status: 200, data: { period, days: [] } },
    );
    restore = mock.restore;
    renderRoutes(routes, { path: '/admin', auth: authValue({ user: admin }) });
    expect(await screen.findByText('No sales in this period.')).toBeInTheDocument();
  });
});

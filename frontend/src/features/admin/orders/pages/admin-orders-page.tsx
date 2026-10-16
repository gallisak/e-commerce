import { useQuery } from '@tanstack/react-query';
import { ReceiptTextIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import {
  isOrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  shortOrderId,
} from '@/features/orders/order-status';
import type { OrderStatus } from '@/lib/api/types';
import { isDateString } from '@/lib/dates';
import { formatDateTime, formatPrice, pluralize } from '@/lib/format';
import { buildQuery, patchParams, readPage } from '@/lib/search-params';
import { useDocumentTitle } from '@/lib/use-document-title';
import { adminOrdersQuery } from '../api';

const ALL = 'ALL';
const STATUS_OPTIONS = [
  { value: ALL, label: 'All statuses' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
];

export function AdminOrdersPage() {
  useDocumentTitle('Orders');
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const status = isOrderStatus(rawStatus) ? rawStatus : undefined;
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const from = isDateString(rawFrom) ? rawFrom : undefined;
  const to = isDateString(rawTo) && (!from || rawTo >= from) ? rawTo : undefined;
  const page = readPage(params.get('page'));
  const orders = useQuery(adminOrdersQuery({ page, status, from, to }));

  const href = (next: { status?: OrderStatus; from?: string; to?: string; page?: number }) =>
    buildQuery({ status, from, to, page, ...next });
  const hasFilters = Boolean(status || from || to);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-1.5">
          <Label id="admin-orders-status">Status</Label>
          <Select
            items={STATUS_OPTIONS}
            value={status ?? ALL}
            onValueChange={(value) =>
              setParams((prev) =>
                patchParams(prev, { status: isOrderStatus(value) ? value : null, page: null }),
              )
            }
          >
            <SelectTrigger aria-labelledby="admin-orders-status" className="w-full lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateFilter
          key={`${from ?? ''}:${to ?? ''}`}
          from={from}
          to={to}
          onApply={(range) =>
            setParams((prev) =>
              patchParams(prev, { from: range.from ?? null, to: range.to ?? null, page: null }),
            )
          }
        />
        {hasFilters && (
          <ButtonLink variant="ghost" to="/admin/orders">
            Reset filters
          </ButtonLink>
        )}
      </div>

      {orders.isError && !orders.data ? (
        <ErrorState
          error={orders.error}
          title="Could not load orders"
          onRetry={() => orders.refetch()}
        />
      ) : !orders.data ? (
        <div role="status" aria-label="Loading orders" className="space-y-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-14 w-full" />
          ))}
        </div>
      ) : orders.data.items.length === 0 && page > 1 ? (
        <EmptyState icon={ReceiptTextIcon} title="This page is empty">
          <ButtonLink variant="outline" to={`/admin/orders${href({ page: 1 })}`}>
            Go to the first page
          </ButtonLink>
        </EmptyState>
      ) : orders.data.items.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={hasFilters ? 'No orders match the filters' : 'No orders yet'}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pluralize(orders.data.meta.total, 'order')}
          </p>
          <div className="rounded-xl border" aria-busy={orders.isPlaceholderData}>
            <Table aria-label="Orders">
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.data.items.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-medium hover:underline"
                      >
                        #{shortOrderId(order.id)}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-56 sm:table-cell">
                      <span className="block truncate">{order.customer.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {order.customer.email}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {pluralize(order.itemsCount, 'product')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(order.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            label="Order pages"
            page={orders.data.meta.page}
            totalPages={orders.data.meta.totalPages}
            hrefFor={(target) => `/admin/orders${href({ page: target })}`}
          />
        </>
      )}
    </div>
  );
}

interface DateFilterProps {
  from?: string;
  to?: string;
  onApply: (range: { from?: string; to?: string }) => void;
}

function DateFilter({ from, to, onApply }: DateFilterProps) {
  const [draftFrom, setDraftFrom] = useState(from ?? '');
  const [draftTo, setDraftTo] = useState(to ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setError('The start date must not be after the end date');
      return;
    }
    setError(null);
    onApply({ from: draftFrom || undefined, to: draftTo || undefined });
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin-orders-from">From</Label>
          <Input
            id="admin-orders-from"
            type="date"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(event) => setDraftFrom(event.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-orders-to">To</Label>
          <Input
            id="admin-orders-to"
            type="date"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(event) => setDraftTo(event.target.value)}
            className="w-40"
          />
        </div>
        <Button type="submit" variant="outline">
          Apply dates
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

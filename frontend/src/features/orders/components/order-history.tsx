import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, PackageIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrderStatus } from '@/lib/api/types';
import { formatDateTime, formatPrice, pluralize } from '@/lib/format';
import { buildQuery, patchParams, readPage } from '@/lib/search-params';
import { myOrdersQuery } from '../api';
import { isOrderStatus, ORDER_STATUS_LABELS, ORDER_STATUSES, shortOrderId } from '../order-status';
import { OrderStatusBadge } from './order-status-badge';

const ALL = 'ALL';

const STATUS_OPTIONS = [
  { value: ALL, label: 'All statuses' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
];

export function OrderHistory() {
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const status: OrderStatus | undefined = isOrderStatus(rawStatus) ? rawStatus : undefined;
  const page = readPage(params.get('page'));
  const orders = useQuery(myOrdersQuery({ page, status }));

  const hrefFor = (target: { page?: number; status?: OrderStatus }) =>
    buildQuery({ status: target.status, page: target.page });

  const changeStatus = (value: string | null) => {
    setParams((prev) =>
      patchParams(prev, { status: isOrderStatus(value) ? value : null, page: null }),
    );
  };

  return (
    <section aria-labelledby="order-history-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="order-history-heading" className="text-xl font-semibold tracking-tight">
          Order history
        </h2>
        <Select items={STATUS_OPTIONS} value={status ?? ALL} onValueChange={changeStatus}>
          <SelectTrigger aria-label="Filter by status" className="w-44">
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

      {orders.isError && !orders.data ? (
        <ErrorState
          error={orders.error}
          title="Could not load your orders"
          onRetry={() => orders.refetch()}
        />
      ) : !orders.data ? (
        <div role="status" aria-label="Loading orders" className="space-y-2">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : orders.data.items.length === 0 ? (
        <EmptyOrders status={status} page={page} onShowAll={() => changeStatus(ALL)} />
      ) : (
        <>
          <ul
            aria-label="Orders"
            aria-busy={orders.isPlaceholderData}
            className="divide-y rounded-xl border"
          >
            {orders.data.items.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/account/orders/${order.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      Order #{shortOrderId(order.id)}
                      <OrderStatusBadge status={order.status} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
                      {' · '}
                      {pluralize(order.itemsCount, 'product')}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatPrice(order.totalAmount)}
                  </span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            label="Order pages"
            page={orders.data.meta.page}
            totalPages={orders.data.meta.totalPages}
            hrefFor={(target) => `/account${hrefFor({ page: target, status })}`}
          />
        </>
      )}
    </section>
  );
}

function EmptyOrders({
  status,
  page,
  onShowAll,
}: {
  status?: OrderStatus;
  page: number;
  onShowAll: () => void;
}) {
  if (page > 1) {
    return (
      <EmptyState icon={PackageIcon} title="This page is empty">
        <ButtonLink variant="outline" to={status ? `/account?status=${status}` : '/account'}>
          Go to the first page
        </ButtonLink>
      </EmptyState>
    );
  }
  if (status) {
    return (
      <EmptyState
        icon={PackageIcon}
        title={`No ${ORDER_STATUS_LABELS[status].toLowerCase()} orders`}
      >
        <Button variant="outline" onClick={onShowAll}>
          Show all orders
        </Button>
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={PackageIcon}
      title="No orders yet"
      description="When you place an order, it will appear here."
    >
      <ButtonLink to="/">Start shopping</ButtonLink>
    </EmptyState>
  );
}

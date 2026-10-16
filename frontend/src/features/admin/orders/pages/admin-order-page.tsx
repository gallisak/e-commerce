import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, Loader2Icon, PackageXIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { OrderTimeline } from '@/features/orders/components/order-timeline';
import { OrderItemsCard } from '@/features/orders/components/order-items-card';
import { shortOrderId } from '@/features/orders/order-status';
import { toApiError } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { useDocumentTitle } from '@/lib/use-document-title';
import { adminOrderQuery } from '../api';
import { StatusChanger } from '../components/status-changer';

export function AdminOrderPage() {
  const { orderId = '' } = useParams();
  const validId = isUuid(orderId);
  const order = useQuery({ ...adminOrderQuery(orderId), enabled: validId });
  useDocumentTitle(validId ? `Order ${shortOrderId(orderId)}` : 'Order not found');

  const notFound =
    !validId || (order.isError && [400, 404].includes(toApiError(order.error).status));

  let content;
  if (notFound) {
    content = (
      <EmptyState icon={PackageXIcon} title="Order not found">
        <ButtonLink variant="outline" to="/admin/orders">
          Back to orders
        </ButtonLink>
      </EmptyState>
    );
  } else if (order.isError && !order.data) {
    content = (
      <ErrorState
        error={order.error}
        title="Could not load the order"
        onRetry={() => order.refetch()}
      />
    );
  } else if (!order.data) {
    content = (
      <div role="status" aria-label="Loading order" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  } else {
    const { id, status, shippingAddress, cancelReason, customer, createdAt } = order.data;
    content = (
      <>
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            Order #{shortOrderId(id)}
            <OrderStatusBadge status={status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed on <time dateTime={createdAt}>{formatDateTime(createdAt)}</time>
          </p>
        </div>
        {status === 'NEW' && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Waiting for the payment to be processed…
          </p>
        )}
        {status === 'CANCELLED' && cancelReason && (
          <Alert variant="destructive">
            <AlertTitle>Cancelled</AlertTitle>
            <AlertDescription>{cancelReason}</AlertDescription>
          </Alert>
        )}
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <OrderItemsCard order={order.data} />
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Customer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm break-words">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-muted-foreground">{customer.email}</p>
                  <p className="pt-2">{shippingAddress}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>History</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderTimeline history={order.data.statusHistory} />
                </CardContent>
              </Card>
            </div>
          </div>
          <Card className="xl:sticky xl:top-20">
            <CardHeader>
              <CardTitle>Update status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusChanger key={id} order={order.data} />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        Orders
      </Link>
      {content}
    </div>
  );
}

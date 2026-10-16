import { useQuery } from '@tanstack/react-query';
import { CheckCircle2Icon, ChevronLeftIcon, Loader2Icon, PackageXIcon } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toApiError } from '@/lib/api/errors';
import { formatDateTime, formatPrice } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { useDocumentTitle } from '@/lib/use-document-title';
import { myOrderQuery } from '../api';
import { CancelOrderButton } from '../components/cancel-order-button';
import { OrderStatusBadge } from '../components/order-status-badge';
import { OrderTimeline } from '../components/order-timeline';
import { CUSTOMER_CANCELLABLE, shortOrderId } from '../order-status';

export function OrderPage() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const justPlaced = (location.state as { placed?: boolean } | null)?.placed === true;
  const validId = isUuid(orderId);
  const order = useQuery({ ...myOrderQuery(orderId), enabled: validId });
  useDocumentTitle(validId ? `Order ${shortOrderId(orderId)}` : 'Order not found');

  const notFound =
    !validId || (order.isError && [400, 404].includes(toApiError(order.error).status));

  if (notFound) {
    return (
      <EmptyState
        icon={PackageXIcon}
        title="Order not found"
        description="It does not exist or belongs to another account."
      >
        <ButtonLink variant="outline" to="/account">
          Back to my orders
        </ButtonLink>
      </EmptyState>
    );
  }

  if (order.isError && !order.data) {
    return (
      <ErrorState
        error={order.error}
        title="Could not load the order"
        onRetry={() => order.refetch()}
      />
    );
  }

  if (!order.data) {
    return (
      <div role="status" aria-label="Loading order" className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const {
    id,
    status,
    totalAmount,
    shippingAddress,
    cancelReason,
    items,
    statusHistory,
    createdAt,
  } = order.data;

  return (
    <div className="space-y-6">
      <Link
        to="/account"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        My orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            Order #{shortOrderId(id)}
            <OrderStatusBadge status={status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed on <time dateTime={createdAt}>{formatDateTime(createdAt)}</time>
          </p>
        </div>
        {CUSTOMER_CANCELLABLE.includes(status) && <CancelOrderButton orderId={id} />}
      </div>

      {justPlaced && status !== 'CANCELLED' && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Thank you! Your order has been placed.</AlertTitle>
          <AlertDescription>
            The items are reserved for you. You can follow the order status on this page.
          </AlertDescription>
        </Alert>
      )}
      {status === 'NEW' && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Payment is being processed…
        </p>
      )}
      {status === 'CANCELLED' && cancelReason && (
        <Alert variant="destructive">
          <AlertTitle>This order was cancelled</AlertTitle>
          <AlertDescription>{cancelReason}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul aria-label="Order items" className="divide-y">
              {items.map((item) => (
                <li key={item.productId} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <Link
                      to={`/products/${item.productId}`}
                      className="font-medium hover:underline"
                    >
                      {item.productName}
                    </Link>
                    <span className="block text-muted-foreground tabular-nums">
                      {item.quantity} × {formatPrice(item.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipping address</CardTitle>
            </CardHeader>
            <CardContent className="text-sm break-words">{shippingAddress}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline history={statusHistory} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { OrderDetail } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { PaymentSummary } from './payment-summary';

interface OrderItemsCardProps {
  order: Pick<OrderDetail, 'items' | 'totalAmount' | 'payment'>;
  linkProducts?: boolean;
}

export function OrderItemsCard({ order, linkProducts = false }: OrderItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul aria-label="Order items" className="divide-y">
          {order.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3 py-2">
              <span className="min-w-0">
                {linkProducts ? (
                  <Link to={`/products/${item.productId}`} className="font-medium hover:underline">
                    {item.productName}
                  </Link>
                ) : (
                  <span className="font-medium">{item.productName}</span>
                )}
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
          <span className="tabular-nums">{formatPrice(order.totalAmount)}</span>
        </div>
        <PaymentSummary payment={order.payment} />
      </CardContent>
    </Card>
  );
}

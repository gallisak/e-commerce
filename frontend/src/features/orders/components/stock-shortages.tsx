import { AlertCircleIcon } from 'lucide-react';
import { ButtonLink } from '@/components/button-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { StockShortage } from '@/lib/api/types';

export function StockShortages({ items }: { items: StockShortage[] }) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>Some items are no longer available</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {items.map((item) => (
            <li key={item.productId}>
              {item.name}: you asked for {item.requested},{' '}
              {item.available > 0 ? `only ${item.available} left` : 'out of stock'}
            </li>
          ))}
        </ul>
        <ButtonLink variant="outline" size="sm" to="/cart" className="mt-3">
          Review the cart
        </ButtonLink>
      </AlertDescription>
    </Alert>
  );
}

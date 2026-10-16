import type { OrderStatusChange } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '../order-status';

export function OrderTimeline({ history }: { history: OrderStatusChange[] }) {
  return (
    <ol aria-label="Status history" className="relative space-y-4 border-l pl-5">
      {history.map((entry, index) => (
        <li key={`${entry.toStatus}-${entry.createdAt}-${index}`} className="relative">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-background bg-primary"
          />
          <p className="text-sm font-medium">{ORDER_STATUS_LABELS[entry.toStatus]}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
          </p>
          {entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}

import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '../order-status';

const STATUS_CLASSES: Record<OrderStatus, string> = {
  NEW: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  PROCESSING:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  SHIPPED:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300',
  COMPLETED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

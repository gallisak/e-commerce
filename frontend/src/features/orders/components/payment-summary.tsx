import { CreditCardIcon } from 'lucide-react';
import type { OrderPayment, PaymentStatus } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'Paid',
  NOT_PAID: 'Not paid',
  REFUND_PENDING: 'Refund in progress',
  REFUNDED: 'Refunded',
};

export function PaymentSummary({ payment }: { payment: OrderPayment }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <CreditCardIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p>
          <span className="text-muted-foreground">Payment: </span>
          <span
            className={cn(
              'font-medium',
              payment.status === 'REFUNDED' && 'text-emerald-700 dark:text-emerald-400',
            )}
          >
            {LABELS[payment.status]}
          </span>
        </p>
        {payment.refundedAt && (
          <p className="text-muted-foreground">
            Refunded on{' '}
            <time dateTime={payment.refundedAt}>{formatDateTime(payment.refundedAt)}</time>
          </p>
        )}
        {payment.transactionId && (
          <p className="truncate font-mono text-xs text-muted-foreground">
            {payment.transactionId}
          </p>
        )}
      </div>
    </div>
  );
}

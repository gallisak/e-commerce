import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/api/errors';
import { cancelOrderSchema } from '../schemas';
import { useCancelOrder } from '../use-orders';

interface CancelOrderButtonProps {
  orderId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CancelOrderButton({ orderId, open, onOpenChange }: CancelOrderButtonProps) {
  const cancel = useCancelOrder(orderId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    const parsed = cancelOrderSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid reason');
      throw parsed.error;
    }
    try {
      await cancel.mutateAsync(parsed.data.reason || undefined);
      toast.success('Order cancelled');
    } catch (cause) {
      toast.error(errorMessage(cause));
      throw cause;
    }
  };

  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Cancel order</Button>}
      title="Cancel this order?"
      description="The reserved items will be returned to stock. This cannot be undone."
      confirmLabel="Cancel order"
      pendingLabel="Cancelling…"
      cancelLabel="Keep order"
      onConfirm={confirm}
      open={open}
      onOpenChange={onOpenChange}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="cancel-reason">Reason (optional)</FieldLabel>
        <Textarea
          id="cancel-reason"
          rows={2}
          maxLength={500}
          value={reason}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'cancel-reason-error' : undefined}
          onChange={(event) => {
            setReason(event.target.value.replace(/[\r\n]+/g, ' '));
            setError(null);
          }}
        />
        <FieldError id="cancel-reason-error" errors={error ? [{ message: error }] : undefined} />
      </Field>
    </ConfirmDialog>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { catalogKeys } from '@/features/catalog/api';
import { orderKeys } from '@/features/orders/api';
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '@/features/orders/order-status';
import { errorMessage } from '@/lib/api/errors';
import type { OrderDetail, OrderStatus } from '@/lib/api/types';
import { adminKeys, adminOrdersApi } from '../api';

const NOTE_MAX = 500;
const SINGLE_LINE = /^[^\p{Cc}]*$/u;

export function StatusChanger({ order }: { order: OrderDetail }) {
  const queryClient = useQueryClient();
  const options = ORDER_TRANSITIONS[order.status];
  const [next, setNext] = useState<OrderStatus>(options[0] ?? order.status);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (status: OrderStatus) =>
      adminOrdersApi.updateStatus(order.id, status, note.trim() || undefined),
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.order(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      if (updated.status === 'CANCELLED') {
        void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      }
      toast.success(`Order marked as ${ORDER_STATUS_LABELS[updated.status].toLowerCase()}`);
      setNote('');
    },
    onError: (cause) => {
      toast.error(errorMessage(cause));
      void queryClient.invalidateQueries({ queryKey: adminKeys.order(order.id) });
    },
  });

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This order is {ORDER_STATUS_LABELS[order.status].toLowerCase()}. Its status can no longer be
        changed.
      </p>
    );
  }

  const validate = () => {
    if (note.trim().length > NOTE_MAX) return `Note must be at most ${NOTE_MAX} characters`;
    if (!SINGLE_LINE.test(note)) return 'Note must be on one line';
    return null;
  };

  const submit = async () => {
    const problem = validate();
    setError(problem);
    if (problem) throw new Error(problem);
    await update.mutateAsync(next);
  };

  const items = options.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] }));
  const submitLabel = `Mark as ${ORDER_STATUS_LABELS[next].toLowerCase()}`;

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel id="order-next-status">New status</FieldLabel>
        <Select
          items={items}
          value={next}
          onValueChange={(value) => value && setNext(value as OrderStatus)}
        >
          <SelectTrigger aria-labelledby="order-next-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="order-status-note">Note (optional)</FieldLabel>
        <Textarea
          id="order-status-note"
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          aria-invalid={error ? true : undefined}
          aria-describedby="order-status-note-hint order-status-note-error"
          onChange={(event) => {
            setNote(event.target.value.replace(/[\r\n]+/g, ' '));
            setError(null);
          }}
        />
        <FieldDescription id="order-status-note-hint">
          {next === 'CANCELLED'
            ? 'Shown to the customer as the cancellation reason.'
            : 'Saved in the order history.'}
        </FieldDescription>
        <FieldError
          id="order-status-note-error"
          errors={error ? [{ message: error }] : undefined}
        />
      </Field>
      {next === 'CANCELLED' ? (
        <ConfirmDialog
          trigger={
            <Button variant="destructive" className="w-full">
              Cancel order
            </Button>
          }
          title="Cancel this order?"
          description="The reserved items return to stock. This cannot be undone."
          confirmLabel="Cancel order"
          pendingLabel="Cancelling…"
          cancelLabel="Keep order"
          onConfirm={submit}
        />
      ) : (
        <Button
          className="w-full"
          disabled={update.isPending}
          onClick={() => void submit().catch(() => undefined)}
        >
          {update.isPending ? 'Saving…' : submitLabel}
        </Button>
      )}
    </div>
  );
}

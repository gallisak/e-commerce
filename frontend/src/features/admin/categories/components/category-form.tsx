import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/form-error';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { applyServerError } from '@/lib/forms';
import { type CategoryFormValues, categorySchema } from '../schemas';

interface CategoryFormProps {
  idPrefix: string;
  defaultValues?: CategoryFormValues;
  submitLabel: string;
  slugHint?: string;
  onSubmit: (values: CategoryFormValues) => Promise<unknown>;
  onCancel?: () => void;
}

export function CategoryForm({
  idPrefix,
  defaultValues = { name: '', slug: '' },
  submitLabel,
  slugHint,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      reset(defaultValues);
    } catch (error) {
      applyServerError(error, setError, ['name', 'slug']);
    }
  });

  return (
    <form noValidate onSubmit={submit} className="space-y-3">
      <FormError message={errors.root?.server?.message} />
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <TextField
          id={`${idPrefix}-name`}
          label="Name"
          registration={register('name')}
          error={errors.name}
        />
        <TextField
          id={`${idPrefix}-slug`}
          label="Slug"
          placeholder="generated from the name"
          description={slugHint}
          registration={register('slug')}
          error={errors.slug}
        />
        <div className="flex gap-2 sm:pt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

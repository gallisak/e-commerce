import type { ComponentProps } from 'react';
import type { FieldError as HookFieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, 'id' | 'name'> {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: HookFieldError;
  description?: string;
}

export function TextField({
  id,
  label,
  registration,
  error,
  description,
  ...inputProps
}: TextFieldProps) {
  const describedBy = [description && `${id}-description`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
        {...registration}
      />
      {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
      <FieldError id={`${id}-error`} errors={error ? [error] : undefined} />
    </Field>
  );
}

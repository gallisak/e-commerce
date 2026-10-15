import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/form-error';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { toApiError } from '@/lib/api/errors';
import { applyServerError } from '@/lib/forms';
import { type RegisterValues, registerSchema } from '../schemas';
import { useAuth } from '../use-auth';

export function RegisterForm() {
  const { register: signUp } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    try {
      await signUp({ name, email, password });
    } catch (error) {
      if (toApiError(error).status === 409) {
        setError('email', { message: 'This email is already registered' });
        return;
      }
      applyServerError(error, setError, ['name', 'email', 'password']);
    }
  });

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup>
        <FormError message={errors.root?.server?.message} />
        <TextField
          id="register-name"
          label="Name"
          autoComplete="name"
          registration={register('name')}
          error={errors.name}
        />
        <TextField
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          registration={register('email')}
          error={errors.email}
        />
        <TextField
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters, including a letter and a digit."
          registration={register('password')}
          error={errors.password}
        />
        <TextField
          id="register-confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          registration={register('confirmPassword')}
          error={errors.confirmPassword}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </FieldGroup>
    </form>
  );
}

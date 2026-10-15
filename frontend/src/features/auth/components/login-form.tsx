import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormError } from '@/components/form/form-error';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { applyServerError } from '@/lib/forms';
import { type LoginValues, loginSchema } from '../schemas';
import { useAuth } from '../use-auth';

export function LoginForm() {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
    } catch (error) {
      applyServerError(error, setError, ['email', 'password']);
    }
  });

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup>
        <FormError message={errors.root?.server?.message} />
        <TextField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          registration={register('email')}
          error={errors.email}
        />
        <TextField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          registration={register('password')}
          error={errors.password}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </FieldGroup>
    </form>
  );
}

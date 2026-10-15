import { Link, useSearchParams } from 'react-router';
import { RegisterForm } from '../components/register-form';
import { REDIRECT_PARAM } from '../redirect';
import { AuthCard } from './auth-card';

export function RegisterPage() {
  const [params] = useSearchParams();
  const redirect = params.get(REDIRECT_PARAM);
  const loginLink = redirect
    ? `/login?${REDIRECT_PARAM}=${encodeURIComponent(redirect)}`
    : '/login';

  return (
    <AuthCard
      title="Create an account"
      description="Sign up to place orders and track their status."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to={loginLink}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}

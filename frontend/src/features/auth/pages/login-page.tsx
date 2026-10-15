import { Link, useSearchParams } from 'react-router';
import { LoginForm } from '../components/login-form';
import { REDIRECT_PARAM } from '../redirect';
import { AuthCard } from './auth-card';

export function LoginPage() {
  const [params] = useSearchParams();
  const redirect = params.get(REDIRECT_PARAM);
  const registerLink = redirect
    ? `/register?${REDIRECT_PARAM}=${encodeURIComponent(redirect)}`
    : '/register';

  return (
    <AuthCard
      title="Log in"
      description="Welcome back! Log in to continue shopping."
      footer={
        <span>
          New here?{' '}
          <Link
            to={registerLink}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}

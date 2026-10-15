import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/errors';
import { authValue, customer, renderPage } from '@/test/render';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('validates the fields before calling the API', async () => {
    const auth = authValue();
    renderPage(<LoginForm />, { auth });

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('submits trimmed credentials', async () => {
    const auth = authValue({ login: vi.fn().mockResolvedValue(customer) });
    renderPage(<LoginForm />, { auth });

    await userEvent.type(screen.getByLabelText('Email'), '  customer@example.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'Customer12345!');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() =>
      expect(auth.login).toHaveBeenCalledWith({
        email: 'customer@example.com',
        password: 'Customer12345!',
      }),
    );
  });

  it('shows the server message for wrong credentials', async () => {
    const auth = authValue({
      login: vi
        .fn()
        .mockRejectedValue(new ApiError({ status: 401, messages: ['Invalid email or password'] })),
    });
    renderPage(<LoginForm />, { auth });

    await userEvent.type(screen.getByLabelText('Email'), 'customer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('tells the user how long to wait when rate limited', async () => {
    const auth = authValue({
      login: vi
        .fn()
        .mockRejectedValue(
          new ApiError({ status: 429, messages: ['ThrottlerException'], retryAfterSeconds: 37 }),
        ),
    });
    renderPage(<LoginForm />, { auth });

    await userEvent.type(screen.getByLabelText('Email'), 'customer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 37 seconds.',
    );
  });
});

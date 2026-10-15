import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/errors';
import { authValue, customer, renderPage } from '@/test/render';
import { RegisterForm } from './register-form';

async function fill(values: {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}) {
  if (values.name) await userEvent.type(screen.getByLabelText('Name'), values.name);
  if (values.email) await userEvent.type(screen.getByLabelText('Email'), values.email);
  if (values.password) await userEvent.type(screen.getByLabelText('Password'), values.password);
  if (values.confirm)
    await userEvent.type(screen.getByLabelText('Confirm password'), values.confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterForm', () => {
  it('applies the same password rules as the API', async () => {
    const auth = authValue();
    renderPage(<RegisterForm />, { auth });

    await fill({
      name: 'Jane',
      email: 'jane@example.com',
      password: 'onlyletters',
      confirm: 'other',
    });

    expect(
      await screen.findByText('Password must contain a letter and a digit'),
    ).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('sends the account data without the confirmation field', async () => {
    const auth = authValue({ register: vi.fn().mockResolvedValue(customer) });
    renderPage(<RegisterForm />, { auth });

    await fill({
      name: ' Jane Doe ',
      email: 'jane@example.com',
      password: 'Secret123',
      confirm: 'Secret123',
    });

    await waitFor(() =>
      expect(auth.register).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Secret123',
      }),
    );
  });

  it('marks the email field when it is already registered', async () => {
    const auth = authValue({
      register: vi
        .fn()
        .mockRejectedValue(
          new ApiError({ status: 409, messages: ['Email is already registered'] }),
        ),
    });
    renderPage(<RegisterForm />, { auth });

    await fill({
      name: 'Jane',
      email: 'customer@example.com',
      password: 'Secret123',
      confirm: 'Secret123',
    });

    expect(await screen.findByText('This email is already registered')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('maps API validation messages to the matching fields', async () => {
    const auth = authValue({
      register: vi.fn().mockRejectedValue(
        new ApiError({
          status: 400,
          messages: ['name must not contain line breaks or control characters'],
        }),
      ),
    });
    renderPage(<RegisterForm />, { auth });

    await fill({
      name: 'Jane',
      email: 'jane@example.com',
      password: 'Secret123',
      confirm: 'Secret123',
    });

    expect(
      await screen.findByText('Name must not contain line breaks or control characters'),
    ).toBeInTheDocument();
  });
});

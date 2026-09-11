import { render, screen } from '@testing-library/react';
import RegisterPage from './page';

function params(searchParams: Record<string, string> = {}) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) };
}

describe('RegisterPage', () => {
  it('renders a POST form to /api/auth/register with name, email, and password fields', async () => {
    render(await RegisterPage(params()));

    const form = document.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/api/auth/register');
    expect(form?.getAttribute('method')).toBe('POST');
    expect(screen.getByLabelText('Name (optional)')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('shows the matching message for a known ?error= code', async () => {
    render(await RegisterPage(params({ error: 'email_taken' })));

    expect(screen.getByRole('alert').textContent).toBe(
      'An account with that email already exists.',
    );
  });

  it('shows no error message when there is no ?error=', async () => {
    render(await RegisterPage(params()));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('links to /login', async () => {
    render(await RegisterPage(params()));

    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
  });
});

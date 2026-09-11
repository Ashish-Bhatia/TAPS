import { render, screen } from '@testing-library/react';
import LoginPage from './page';

function params(searchParams: Record<string, string> = {}) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) };
}

describe('LoginPage', () => {
  it('renders a POST form to /api/auth/login with email and password fields', async () => {
    render(await LoginPage(params()));

    const form = document.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/api/auth/login');
    expect(form?.getAttribute('method')).toBe('POST');
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('shows no error message when there is no ?error=', async () => {
    render(await LoginPage(params()));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the matching message for a known ?error= code', async () => {
    render(await LoginPage(params({ error: 'invalid_credentials' })));

    expect(screen.getByRole('alert').textContent).toBe('Incorrect email or password.');
  });

  it('falls back to a generic message for an unrecognized ?error= code', async () => {
    render(await LoginPage(params({ error: 'something-unexpected' })));

    expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Please try again.');
  });

  it('links to /register', async () => {
    render(await LoginPage(params()));

    expect(screen.getByRole('link', { name: 'Register' }).getAttribute('href')).toBe('/register');
  });
});

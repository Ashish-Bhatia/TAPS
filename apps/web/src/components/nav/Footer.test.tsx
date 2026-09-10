import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the four static/legal page links per the PRD MVP scope', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'About Us' }).getAttribute('href')).toBe('/about');
    expect(screen.getByRole('link', { name: 'Contact Us' }).getAttribute('href')).toBe('/contact');
    expect(screen.getByRole('link', { name: 'Disclaimer' }).getAttribute('href')).toBe(
      '/disclaimer',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/privacy',
    );
  });
});

import { render, screen } from '@testing-library/react';
import { ComingSoon } from './ComingSoon';

describe('ComingSoon', () => {
  it('renders the title and an optional note', () => {
    render(<ComingSoon title="Syllabus" note="extra detail" />);

    expect(screen.getByRole('heading', { name: 'Syllabus' })).toBeTruthy();
    expect(screen.getByText(/extra detail/)).toBeTruthy();
  });

  it('renders without a note', () => {
    render(<ComingSoon title="About Us" />);

    expect(screen.getByRole('heading', { name: 'About Us' })).toBeTruthy();
  });
});

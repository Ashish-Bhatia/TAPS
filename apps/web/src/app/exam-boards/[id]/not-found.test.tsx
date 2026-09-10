import { render, screen } from '@testing-library/react';
import ExamBoardNotFound from './not-found';

describe('ExamBoardNotFound', () => {
  it('renders a clear message and a way back home, not a raw error', () => {
    render(<ExamBoardNotFound />);

    expect(screen.getByRole('heading', { name: /not found/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to home/i }).getAttribute('href')).toBe('/');
  });
});

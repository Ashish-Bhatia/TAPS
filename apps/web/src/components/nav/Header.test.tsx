import { render, screen } from '@testing-library/react';
import type { ExamBoard } from '../../lib/types';
import { Header } from './Header';

function makeBoard(overrides: Partial<ExamBoard>): ExamBoard {
  return {
    id: 'id-1',
    name: 'DSSSB',
    type: 'TEACHING',
    description: 'x',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Header', () => {
  it('renders the static nav items and the Home link', () => {
    render(<Header examBoards={[]} />);

    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Syllabus' }).getAttribute('href')).toBe('/syllabus');
    expect(screen.getByRole('link', { name: 'NCERT Books' }).getAttribute('href')).toBe(
      '/ncert-books',
    );
  });

  it('groups exam boards into Teaching Exams vs TET-Exams by type', () => {
    render(
      <Header
        examBoards={[
          makeBoard({ id: 'dsssb-id', name: 'DSSSB', type: 'TEACHING' }),
          makeBoard({ id: 'ctet-id', name: 'CTET', type: 'TET' }),
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'DSSSB' }).getAttribute('href')).toBe(
      '/exam-boards/dsssb-id',
    );
    expect(screen.getByRole('link', { name: 'CTET' }).getAttribute('href')).toBe(
      '/exam-boards/ctet-id',
    );
  });

  it('shows a fallback message in a dropdown with no boards, instead of an empty menu', () => {
    render(<Header examBoards={[]} />);

    expect(screen.getAllByText('No exam boards available yet')).toHaveLength(2);
  });
});

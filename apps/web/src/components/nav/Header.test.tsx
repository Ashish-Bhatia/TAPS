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
    render(<Header examBoards={[]} hasSession={false} />);

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
        hasSession={false}
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
    render(<Header examBoards={[]} hasSession={false} />);

    expect(screen.getAllByText('No exam boards available yet')).toHaveLength(2);
  });

  it('has a search box that GETs to /search (TAPS-3.4, needs no client JS)', () => {
    render(<Header examBoards={[]} hasSession={false} />);

    const form = screen.getByRole('search') as HTMLFormElement;
    expect(form.getAttribute('action')).toBe('/search');
    expect(screen.getByRole('searchbox').getAttribute('name')).toBe('q');
  });

  describe('session-aware auth links (TAPS-5.0.5)', () => {
    it('shows Log in / Register when there is no session', () => {
      render(<Header examBoards={[]} hasSession={false} />);

      expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
      expect(screen.getByRole('link', { name: 'Register' }).getAttribute('href')).toBe('/register');
      expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    });

    it('shows Dashboard + a logout form when there is a session', () => {
      render(<Header examBoards={[]} hasSession={true} />);

      expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe(
        '/dashboard',
      );
      expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();

      const logoutForm = screen.getByRole('button', { name: 'Log out' }).closest('form');
      expect(logoutForm?.getAttribute('action')).toBe('/api/auth/logout');
      expect(logoutForm?.getAttribute('method')).toBe('POST');
    });
  });
});

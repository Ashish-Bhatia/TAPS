import { render, screen } from '@testing-library/react';
import { getExamBoardsForNav } from '../../lib/api';
import SyllabusPage from './page';
import type { ExamBoard } from '../../lib/types';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, getExamBoardsForNav: vi.fn() };
});

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

describe('SyllabusPage (category index)', () => {
  it('links each exam board to its own /exam-boards/[id]/syllabus sub-page', async () => {
    vi.mocked(getExamBoardsForNav).mockResolvedValue([
      makeBoard({ id: 'dsssb-id', name: 'DSSSB' }),
      makeBoard({ id: 'ctet-id', name: 'CTET', type: 'TET' }),
    ]);

    render(await SyllabusPage());

    expect(screen.getByRole('link', { name: 'DSSSB' }).getAttribute('href')).toBe(
      '/exam-boards/dsssb-id/syllabus',
    );
    expect(screen.getByRole('link', { name: 'CTET' }).getAttribute('href')).toBe(
      '/exam-boards/ctet-id/syllabus',
    );
  });

  it('shows a fallback message instead of an empty list when there are no exam boards', async () => {
    vi.mocked(getExamBoardsForNav).mockResolvedValue([]);

    render(await SyllabusPage());

    expect(screen.getByText('No exam boards published yet.')).toBeTruthy();
  });
});

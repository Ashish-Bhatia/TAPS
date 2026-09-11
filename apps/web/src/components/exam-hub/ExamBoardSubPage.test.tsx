import { render, screen } from '@testing-library/react';
import { ExamBoardSubPage } from './ExamBoardSubPage';
import { getExamBoard, getPostsByExamBoard } from '../../lib/api';
import type { ExamBoard, Post } from '../../lib/types';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    getExamBoard: vi.fn(),
    getPostsByExamBoard: vi.fn(),
  };
});

const examBoard: ExamBoard = {
  id: 'board-1',
  name: 'DSSSB',
  type: 'TEACHING',
  description: 'Delhi Subordinate Services Selection Board',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function post(overrides: Partial<Post>): Post {
  return {
    id: 'id',
    examBoardId: 'board-1',
    type: 'ARTICLE',
    category: null,
    title: 'title',
    slug: 'slug',
    body: 'body',
    heroImage: null,
    publishedAt: '2026-02-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ExamBoardSubPage', () => {
  it('renders the board breadcrumb, page title/note, and passes category through to getPostsByExamBoard', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);
    vi.mocked(getPostsByExamBoard).mockResolvedValue([
      post({ id: 'pattern-1', category: 'exam-pattern', title: 'A pattern post' }),
    ]);

    const element = await ExamBoardSubPage({
      examBoardId: 'board-1',
      title: 'Exam Pattern',
      note: 'Some note',
      category: 'exam-pattern',
    });
    render(element);

    expect(getPostsByExamBoard).toHaveBeenCalledWith('board-1', 'exam-pattern');
    expect(screen.getByRole('link', { name: /DSSSB/ }).getAttribute('href')).toBe(
      '/exam-boards/board-1',
    );
    expect(screen.getByRole('heading', { name: 'Exam Pattern' })).toBeTruthy();
    expect(screen.getByText('Some note')).toBeTruthy();
    expect(screen.getByText('A pattern post')).toBeTruthy();
  });

  it('renders an empty-state message when the board has no matching posts', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);
    vi.mocked(getPostsByExamBoard).mockResolvedValue([]);

    const element = await ExamBoardSubPage({
      examBoardId: 'board-1',
      title: 'Eligibility',
      note: 'Some note',
      category: 'eligibility',
    });
    render(element);

    expect(screen.getByText(/No eligibility content published for DSSSB yet/)).toBeTruthy();
  });

  it('propagates notFound() when the exam board does not exist', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(null);

    await expect(
      ExamBoardSubPage({
        examBoardId: 'missing',
        title: 'Eligibility',
        note: 'Some note',
        category: 'eligibility',
      }),
    ).rejects.toThrow();
  });
});

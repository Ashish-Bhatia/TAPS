import { render, screen } from '@testing-library/react';
import { getExamBoard, getPostsByExamBoard } from '../../../lib/api';
import ExamBoardHubPage, { generateMetadata } from './page';
import type { ExamBoard } from '../../../lib/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api')>('../../../lib/api');
  return { ...actual, getExamBoard: vi.fn(), getPostsByExamBoard: vi.fn() };
});

const examBoard: ExamBoard = {
  id: 'board-1',
  name: 'DSSSB',
  type: 'TEACHING',
  description: 'Delhi Subordinate Services Selection Board',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function params(id: string) {
  return { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) };
}

describe('ExamBoardHubPage', () => {
  it('links Exam Pattern and Eligibility to their board-specific pages (TAPS-3.6), and the rest to the generic placeholders', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);
    vi.mocked(getPostsByExamBoard).mockResolvedValue([]);

    render(await ExamBoardHubPage(params('board-1')));

    expect(screen.getByRole('link', { name: 'Exam Pattern' }).getAttribute('href')).toBe(
      '/exam-boards/board-1/exam-pattern',
    );
    expect(screen.getByRole('link', { name: 'Eligibility' }).getAttribute('href')).toBe(
      '/exam-boards/board-1/eligibility',
    );
    expect(screen.getByRole('link', { name: 'Syllabus' }).getAttribute('href')).toBe('/syllabus');
    expect(screen.getByRole('link', { name: 'Previous Papers' }).getAttribute('href')).toBe(
      '/previous-papers',
    );
    expect(screen.getByRole('link', { name: 'Study Material' }).getAttribute('href')).toBe(
      '/study-materials',
    );
  });

  it('renders the empty-notifications message when the board has no posts', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);
    vi.mocked(getPostsByExamBoard).mockResolvedValue([]);

    render(await ExamBoardHubPage(params('board-1')));

    expect(screen.getByText(/No notifications published for DSSSB yet/)).toBeTruthy();
  });
});

describe('ExamBoardHubPage generateMetadata', () => {
  it("titles the page after the board's name", async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);

    await expect(generateMetadata(params('board-1'))).resolves.toEqual({
      title: 'DSSSB — TAPS',
      description: examBoard.description,
    });
  });
});

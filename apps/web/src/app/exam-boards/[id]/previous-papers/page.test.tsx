import { render, screen } from '@testing-library/react';
import { ExamBoardRecordsPage } from '../../../../components/exam-hub/ExamBoardRecordsPage';
import { getExamBoard, getPastPapersByExamBoard } from '../../../../lib/api';
import PreviousPapersPage, { generateMetadata } from './page';
import type { ExamBoard, PastPaper } from '../../../../lib/types';

vi.mock('../../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api')>('../../../../lib/api');
  return { ...actual, getExamBoard: vi.fn(), getPastPapersByExamBoard: vi.fn() };
});

const examBoard: ExamBoard = {
  id: 'board-1',
  name: 'DSSSB',
  type: 'TEACHING',
  description: 'Delhi Subordinate Services Selection Board',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const pastPaper: PastPaper = {
  id: 'paper-1',
  examBoardId: 'board-1',
  subject: 'Mathematics',
  year: 2025,
  fileUrl: 'https://example.com/paper.pdf',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function params(id: string) {
  return { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) };
}

describe('PreviousPapersPage', () => {
  it('renders ExamBoardRecordsPage wired to getPastPapersByExamBoard, with subject/year and a download link', async () => {
    vi.mocked(getPastPapersByExamBoard).mockResolvedValue([pastPaper]);

    const element = await PreviousPapersPage(params('board-1'));

    expect(element.type).toBe(ExamBoardRecordsPage);
    expect(element.props).toMatchObject({ examBoardId: 'board-1', title: 'Previous Papers' });
    expect(typeof element.props.note).toBe('string');

    await expect(element.props.fetchItems(examBoard)).resolves.toEqual([pastPaper]);
    expect(getPastPapersByExamBoard).toHaveBeenCalledWith('board-1');
    expect(element.props.getKey(pastPaper)).toBe('paper-1');
    expect(element.props.emptyMessage(examBoard)).toBe('No past papers published for DSSSB yet.');

    render(<>{element.props.renderItem(pastPaper)}</>);
    expect(screen.getByText('Mathematics — 2025')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download paper' }).getAttribute('href')).toBe(
      'https://example.com/paper.pdf',
    );
  });
});

describe('PreviousPapersPage generateMetadata', () => {
  it("titles the page after the board's name", async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);

    await expect(generateMetadata(params('board-1'))).resolves.toEqual({
      title: 'DSSSB Previous Papers — TAPS',
      description: 'Past papers for DSSSB.',
    });
  });

  it('returns empty metadata when the board does not exist', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(null);

    await expect(generateMetadata(params('missing'))).resolves.toEqual({});
  });
});

import { render, screen } from '@testing-library/react';
import { ExamBoardRecordsPage } from '../../../../components/exam-hub/ExamBoardRecordsPage';
import { getExamBoard, getSyllabusByExamBoard } from '../../../../lib/api';
import SyllabusPage, { generateMetadata } from './page';
import type { ExamBoard, Syllabus } from '../../../../lib/types';

vi.mock('../../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api')>('../../../../lib/api');
  return { ...actual, getExamBoard: vi.fn(), getSyllabusByExamBoard: vi.fn() };
});

const examBoard: ExamBoard = {
  id: 'board-1',
  name: 'DSSSB',
  type: 'TEACHING',
  description: 'Delhi Subordinate Services Selection Board',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const syllabus: Syllabus = {
  id: 'syl-1',
  examBoardId: 'board-1',
  subject: 'Mathematics',
  topics: ['Algebra', 'Geometry'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function params(id: string) {
  return { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) };
}

describe('SyllabusPage', () => {
  it('renders ExamBoardRecordsPage wired to getSyllabusByExamBoard, with subjects and topics', async () => {
    vi.mocked(getSyllabusByExamBoard).mockResolvedValue([syllabus]);

    const element = await SyllabusPage(params('board-1'));

    expect(element.type).toBe(ExamBoardRecordsPage);
    expect(element.props).toMatchObject({ examBoardId: 'board-1', title: 'Syllabus' });
    expect(typeof element.props.note).toBe('string');

    await expect(element.props.fetchItems(examBoard)).resolves.toEqual([syllabus]);
    expect(getSyllabusByExamBoard).toHaveBeenCalledWith('board-1');
    expect(element.props.getKey(syllabus)).toBe('syl-1');
    expect(element.props.emptyMessage(examBoard)).toBe('No syllabus published for DSSSB yet.');

    render(<>{element.props.renderItem(syllabus)}</>);
    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByText('Algebra')).toBeTruthy();
    expect(screen.getByText('Geometry')).toBeTruthy();
  });
});

describe('SyllabusPage generateMetadata', () => {
  it("titles the page after the board's name", async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);

    await expect(generateMetadata(params('board-1'))).resolves.toEqual({
      title: 'DSSSB Syllabus — TAPS',
      description: 'Syllabus subjects and topics for DSSSB.',
    });
  });

  it('returns empty metadata when the board does not exist', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(null);

    await expect(generateMetadata(params('missing'))).resolves.toEqual({});
  });
});

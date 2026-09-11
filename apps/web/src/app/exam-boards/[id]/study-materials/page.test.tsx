import { render, screen } from '@testing-library/react';
import { ExamBoardRecordsPage } from '../../../../components/exam-hub/ExamBoardRecordsPage';
import { getAllStudyMaterials, getExamBoard } from '../../../../lib/api';
import StudyMaterialsPage, { generateMetadata } from './page';
import type { ExamBoard, StudyMaterial } from '../../../../lib/types';

vi.mock('../../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api')>('../../../../lib/api');
  return { ...actual, getExamBoard: vi.fn(), getAllStudyMaterials: vi.fn() };
});

const examBoard: ExamBoard = {
  id: 'board-1',
  name: 'DSSSB',
  type: 'TEACHING',
  description: 'Delhi Subordinate Services Selection Board',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const studyMaterial: StudyMaterial = {
  id: 'sm-1',
  subject: 'Mathematics',
  title: 'Algebra notes',
  fileUrl: 'https://example.com/notes.pdf',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function params(id: string) {
  return { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) };
}

describe('StudyMaterialsPage', () => {
  it('renders ExamBoardRecordsPage wired to getAllStudyMaterials (no board filter), with title/subject and a download link', async () => {
    vi.mocked(getAllStudyMaterials).mockResolvedValue([studyMaterial]);

    const element = await StudyMaterialsPage(params('board-1'));

    expect(element.type).toBe(ExamBoardRecordsPage);
    expect(element.props).toMatchObject({ examBoardId: 'board-1', title: 'Study Material' });
    expect(typeof element.props.note).toBe('string');

    await expect(element.props.fetchItems(examBoard)).resolves.toEqual([studyMaterial]);
    expect(getAllStudyMaterials).toHaveBeenCalledWith();
    expect(element.props.getKey(studyMaterial)).toBe('sm-1');
    expect(element.props.emptyMessage(examBoard)).toBe('No study material published yet.');

    render(<>{element.props.renderItem(studyMaterial)}</>);
    expect(screen.getByText('Algebra notes')).toBeTruthy();
    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download' }).getAttribute('href')).toBe(
      'https://example.com/notes.pdf',
    );
  });
});

describe('StudyMaterialsPage generateMetadata', () => {
  it("titles the page after the board's name", async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);

    await expect(generateMetadata(params('board-1'))).resolves.toEqual({
      title: 'DSSSB Study Material — TAPS',
      description: 'Study material relevant to DSSSB.',
    });
  });

  it('returns empty metadata when the board does not exist', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(null);

    await expect(generateMetadata(params('missing'))).resolves.toEqual({});
  });
});

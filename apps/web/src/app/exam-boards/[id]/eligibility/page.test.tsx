import { ExamBoardSubPage } from '../../../../components/exam-hub/ExamBoardSubPage';
import { getExamBoard } from '../../../../lib/api';
import EligibilityPage, { generateMetadata } from './page';
import type { ExamBoard } from '../../../../lib/types';

vi.mock('../../../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api')>('../../../../lib/api');
  return { ...actual, getExamBoard: vi.fn() };
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

describe('EligibilityPage', () => {
  it('renders ExamBoardSubPage with the resolved id, page title, and a note', async () => {
    const element = await EligibilityPage(params('board-1'));

    expect(element.type).toBe(ExamBoardSubPage);
    expect(element.props).toMatchObject({ examBoardId: 'board-1', title: 'Eligibility' });
    expect(typeof element.props.note).toBe('string');
  });
});

describe('EligibilityPage generateMetadata', () => {
  it("titles the page after the board's name", async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);

    await expect(generateMetadata(params('board-1'))).resolves.toEqual({
      title: 'DSSSB Eligibility — TAPS',
      description: 'Eligibility criteria articles for DSSSB.',
    });
  });

  it('returns empty metadata when the board does not exist', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(null);

    await expect(generateMetadata(params('missing'))).resolves.toEqual({});
  });
});

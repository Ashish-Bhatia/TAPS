import { render, screen } from '@testing-library/react';
import { ExamBoardRecordsPage } from './ExamBoardRecordsPage';
import { getExamBoard } from '../../lib/api';
import type { ExamBoard } from '../../lib/types';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
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

interface Item {
  id: string;
  label: string;
}

describe('ExamBoardRecordsPage', () => {
  it('renders the board breadcrumb, page title/note, and each item via renderItem', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);
    const fetchItems = vi.fn().mockResolvedValue([
      { id: '1', label: 'First item' },
      { id: '2', label: 'Second item' },
    ] satisfies Item[]);

    const element = await ExamBoardRecordsPage<Item>({
      examBoardId: 'board-1',
      title: 'Syllabus',
      note: 'Some note',
      fetchItems,
      getKey: (item) => item.id,
      renderItem: (item) => <span>{item.label}</span>,
      emptyMessage: (board) => `No items for ${board.name}.`,
    });
    render(element);

    expect(fetchItems).toHaveBeenCalledWith(examBoard);
    expect(screen.getByRole('link', { name: /DSSSB/ }).getAttribute('href')).toBe(
      '/exam-boards/board-1',
    );
    expect(screen.getByRole('heading', { name: 'Syllabus' })).toBeTruthy();
    expect(screen.getByText('Some note')).toBeTruthy();
    expect(screen.getByText('First item')).toBeTruthy();
    expect(screen.getByText('Second item')).toBeTruthy();
  });

  it("renders emptyMessage's result when there are no items", async () => {
    vi.mocked(getExamBoard).mockResolvedValue(examBoard);
    const fetchItems = vi.fn().mockResolvedValue([]);

    const element = await ExamBoardRecordsPage<Item>({
      examBoardId: 'board-1',
      title: 'Syllabus',
      note: 'Some note',
      fetchItems,
      getKey: (item) => item.id,
      renderItem: (item) => <span>{item.label}</span>,
      emptyMessage: (board) => `No items for ${board.name}.`,
    });
    render(element);

    expect(screen.getByText('No items for DSSSB.')).toBeTruthy();
  });

  it('propagates notFound() when the exam board does not exist', async () => {
    vi.mocked(getExamBoard).mockResolvedValue(null);
    const fetchItems = vi.fn();

    await expect(
      ExamBoardRecordsPage<Item>({
        examBoardId: 'missing',
        title: 'Syllabus',
        note: 'Some note',
        fetchItems,
        getKey: (item) => item.id,
        renderItem: (item) => <span>{item.label}</span>,
        emptyMessage: () => 'No items.',
      }),
    ).rejects.toThrow();
    expect(fetchItems).not.toHaveBeenCalled();
  });
});

import { examBoards } from './exam-boards.seed-data.ts';

describe('exam-boards seed data', () => {
  it('has exactly the six exam boards this product launches with', () => {
    const names = examBoards.map((board) => board.name).sort();
    expect(names).toEqual(['CTET', 'DSSSB', 'HTET', 'KVS', 'NVS', 'UPTET']);
  });

  it('splits into three TEACHING and three TET boards, matching 05-ARCHITECTURE.md §4', () => {
    const teaching = examBoards.filter((board) => board.type === 'TEACHING').map((b) => b.name);
    const tet = examBoards.filter((board) => board.type === 'TET').map((b) => b.name);

    expect(teaching.sort()).toEqual(['DSSSB', 'KVS', 'NVS']);
    expect(tet.sort()).toEqual(['CTET', 'HTET', 'UPTET']);
  });

  it('every board has a non-empty, reasonably descriptive description', () => {
    for (const board of examBoards) {
      expect(board.description.length).toBeGreaterThan(20);
    }
  });

  it('names have no duplicates (the DB enforces this too, via a unique constraint)', () => {
    const names = examBoards.map((board) => board.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

import { examBoards } from './exam-boards.seed-data.ts';

describe('exam-boards seed data', () => {
  it('has exactly the nine exam boards this product seeds (TAPS-2.4 + TAPS-2.11)', () => {
    const names = examBoards.map((board) => board.name).sort();
    expect(names).toEqual([
      'BPSE',
      'CTET',
      'DSSSB',
      'HTET',
      'KVS',
      'NVS',
      'REET',
      'UP-TGT/PGT',
      'UPTET',
    ]);
  });

  it('splits into six TEACHING and three TET boards, matching the "Teaching Exams" vs "TET-Exams" nav split (docs/adr/007-nav-data-sourcing.md)', () => {
    const teaching = examBoards.filter((board) => board.type === 'TEACHING').map((b) => b.name);
    const tet = examBoards.filter((board) => board.type === 'TET').map((b) => b.name);

    expect(teaching.sort()).toEqual(['BPSE', 'DSSSB', 'KVS', 'NVS', 'REET', 'UP-TGT/PGT']);
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

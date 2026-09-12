import { examBoards } from './exam-boards.seed-data.ts';
import { syllabuses } from './syllabus.seed-data.ts';

describe('syllabus seed data', () => {
  it('only references exam board names that actually exist in exam-boards.seed-data.ts', () => {
    const knownNames = new Set(examBoards.map((board) => board.name));
    for (const entry of syllabuses) {
      expect(knownNames.has(entry.examBoardName)).toBe(true);
    }
  });

  it('has real content for exactly the 4 boards an official source was found for (TAPS-2.14/2.15) — the other 5 are deliberately absent, not fabricated', () => {
    const names = [...new Set(syllabuses.map((entry) => entry.examBoardName))].sort();
    expect(names).toEqual(['CTET', 'DSSSB', 'HTET', 'REET']);
  });

  it('has no duplicate (board, subject) pairs (the DB enforces this too, via a compound unique constraint)', () => {
    const keys = syllabuses.map((entry) => `${entry.examBoardName}::${entry.subject}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a non-empty subject and at least a few real topics', () => {
    for (const entry of syllabuses) {
      expect(entry.subject.length).toBeGreaterThan(0);
      expect(entry.topics.length).toBeGreaterThan(2);
      for (const topic of entry.topics) {
        expect(topic.length).toBeGreaterThan(0);
      }
    }
  });
});

// TAPS-2.15: seed real, official-source syllabus content for the exam
// boards TAPS-2.4/2.11 already seeded. Run with
// `npm run seed:syllabus --workspace=apps/api` (see
// docs/runbooks/database-seeding.md) or `node prisma/seed-syllabus.ts` from
// apps/api/. Seed data lives in syllabus.seed-data.ts, split out so its
// shape is unit-testable (syllabus.seed-data.spec.ts) without needing a
// database connection — same convention as exam-boards.seed-data.ts/seed.ts.
import { PrismaClient } from '@prisma/client';
// Runs directly via `node prisma/seed-syllabus.ts` (Node's built-in TS
// stripping), not compiled through `nest build`/tsc — see seed.ts's own
// comment on why this import needs the real .ts extension.
import { syllabuses } from './syllabus.seed-data.ts';

const prisma = new PrismaClient();

async function main() {
  for (const entry of syllabuses) {
    const examBoard = await prisma.examBoard.findUnique({
      where: { name: entry.examBoardName },
    });
    if (!examBoard) {
      // Deliberately fails the whole run rather than silently skipping: an
      // unknown examBoardName here means this file's data has drifted from
      // exam-boards.seed-data.ts (e.g. a renamed board), which is a real
      // bug to fix, not something to paper over.
      throw new Error(
        `No ExamBoard named "${entry.examBoardName}" found — run the ExamBoard seed ` +
          `(npm run seed --workspace=apps/api) first, or check for a name mismatch.`,
      );
    }

    // upsert keyed by the (examBoardId, subject) compound unique constraint
    // added alongside this story (see schema.prisma) — safe to run this
    // script more than once without creating duplicate subject rows for the
    // same board or clobbering an admin's hand-edited topics list on an
    // unrelated subject.
    const result = await prisma.syllabus.upsert({
      where: { examBoardId_subject: { examBoardId: examBoard.id, subject: entry.subject } },
      update: { topics: entry.topics },
      create: { examBoardId: examBoard.id, subject: entry.subject, topics: entry.topics },
    });
    console.log(`Seeded Syllabus: ${examBoard.name} — ${result.subject} (${result.id})`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

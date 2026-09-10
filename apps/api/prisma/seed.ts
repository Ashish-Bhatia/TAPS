// TAPS-2.4: seed the six exam boards this product launches with. Run with
// `npm run seed --workspace=apps/api` (wraps `prisma db seed`, see
// docs/runbooks/database-seeding.md) or `npx prisma db seed` from
// apps/api/. Seed data itself lives in exam-boards.seed-data.ts, split out
// so its shape is unit-testable without needing a real database connection.
import { PrismaClient } from '@prisma/client';
// This script runs directly via `node prisma/seed.ts` (Node's built-in TS
// stripping, not compiled through `nest build`/tsc), so the import needs
// the real .ts extension here — unlike the rest of apps/api/src, which is
// always compiled first and uses NodeNext's .js-extension convention.
import { examBoards } from './exam-boards.seed-data.ts';

const prisma = new PrismaClient();

async function main() {
  for (const board of examBoards) {
    // upsert keyed by name (unique since TAPS-2.4, see
    // docs/architecture/data-model.md) — safe to run this script more than
    // once (e.g. re-run after a schema change) without creating duplicates
    // or clobbering hand-edited data with a full reset.
    const result = await prisma.examBoard.upsert({
      where: { name: board.name },
      update: { type: board.type, description: board.description },
      create: board,
    });
    console.log(`Seeded ExamBoard: ${result.name} (${result.id})`);
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

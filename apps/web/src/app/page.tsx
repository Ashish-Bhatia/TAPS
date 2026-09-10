import Link from 'next/link';
import { getExamBoardsForNav } from '../lib/api';

// A full "latest notifications" home feed (per 02-PRODUCT-VISION-AND-PRD.md
// §3) is a later story once Post content actually exists at volume — this
// is a minimal, working landing page so "Home" in the nav (TAPS-3.2) isn't
// a dead link, not the final home page design. Re-fetches the same exam
// boards the root layout already fetched — Next.js dedupes identical
// `fetch()` calls within one request, so this doesn't cost an extra
// round trip.
export default async function Home() {
  const examBoards = await getExamBoardsForNav();

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col items-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Prepare for your teaching exam, assessed.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Recruitment notifications, syllabus, previous papers, and study material for teaching and
        TET-level exams — plus the tools to actually practice, not just read.
      </p>

      {examBoards.length > 0 && (
        <div className="mt-10 w-full">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Popular exam boards
          </h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {examBoards.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/exam-boards/${board.id}`}
                  className="block rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  {board.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

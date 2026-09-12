import Link from 'next/link';
import { getExamBoardsForNav } from '../../lib/api';

// TAPS-3.9: was a static ComingSoon placeholder whose copy was stale (it
// said "pending a Syllabus public API", but TAPS-3.8 shipped that API and
// TAPS-3.6 already wired each board's own /exam-boards/[id]/syllabus
// sub-page to it). This is the category-hub half of that: Syllabus content
// is inherently per-board (Syllabus.examBoardId is required), so rather
// than trying to flatten every board's subjects into one page, this lists
// the boards themselves — same "Popular exam boards" data source and link
// target the home page already uses — and links out to each board's real
// sub-page.
export default async function SyllabusPage() {
  const examBoards = await getExamBoardsForNav();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Syllabus</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Published syllabus subjects and topics, by exam board.
      </p>

      {examBoards.length === 0 ? (
        <p className="mt-10 text-zinc-600 dark:text-zinc-400">No exam boards published yet.</p>
      ) : (
        <ul className="mt-10 divide-y divide-black/10 dark:divide-white/10">
          {examBoards.map((board) => (
            <li key={board.id} className="py-4">
              <Link
                href={`/exam-boards/${board.id}/syllabus`}
                className="font-medium hover:underline"
              >
                {board.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { filterArticles, getExamBoard, getPostsByExamBoard } from '../../lib/api';

interface ExamBoardSubPageProps {
  examBoardId: string;
  title: string;
  note: string;
}

/**
 * Shared body for the exam hub's board-specific "Exam Pattern" and
 * "Eligibility" sub-pages (TAPS-3.6) — see `filterArticles` in `lib/api.ts`
 * for why both currently render the same underlying data (a board's
 * `ARTICLE`-type posts) rather than genuinely distinct content. Renders a
 * segment-level `notFound()` (caught by `exam-boards/[id]/not-found.tsx`,
 * same as the hub page itself) when the board id doesn't resolve, same
 * pattern as `exam-boards/[id]/page.tsx`.
 */
export async function ExamBoardSubPage({ examBoardId, title, note }: ExamBoardSubPageProps) {
  const examBoard = await getExamBoard(examBoardId);
  if (!examBoard) {
    notFound();
  }

  const articles = filterArticles(await getPostsByExamBoard(examBoard.id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href={`/exam-boards/${examBoard.id}`}
        className="text-sm font-medium text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← {examBoard.name}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">{note}</p>

      <section className="mt-10">
        {articles.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            No articles published for {examBoard.name} yet.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {articles.map((post) => (
              <li key={post.id} className="py-4">
                <h2 className="font-medium">{post.title}</h2>
                {post.publishedAt && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

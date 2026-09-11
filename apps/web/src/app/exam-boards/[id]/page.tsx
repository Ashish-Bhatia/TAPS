import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExamBoard, getPostsByExamBoard } from '../../../lib/api';

// Sub-sections per the "Exam Hub page" type in
// 03-SOURCE-SITE-CONTENT-INVENTORY.md: overview + links out to Syllabus /
// Pattern / Previous Papers / Study Material / Eligibility.
//
// TAPS-3.6: Exam Pattern and Eligibility became real board-specific pages
// (ExamBoardSubPage, backed by Post — see filterArticles in lib/api.ts for
// the known limitation this leaves). Syllabus, Previous Papers, and Study
// Material still route to the generic placeholder pages TAPS-3.2 built:
// Syllabus/PastPaper/StudyMaterial have Prisma models (TAPS-2.x) but no
// public API endpoints yet (only ExamBoard/Post do, per TAPS-3.1 — see
// apps/api/src/public-content/). Filed as TAPS-3.8, not built here.
function hubSections(examBoardId: string) {
  return [
    { label: 'Syllabus', href: '/syllabus' },
    { label: 'Exam Pattern', href: `/exam-boards/${examBoardId}/exam-pattern` },
    { label: 'Previous Papers', href: '/previous-papers' },
    { label: 'Study Material', href: '/study-materials' },
    { label: 'Eligibility', href: `/exam-boards/${examBoardId}/eligibility` },
  ];
}

export async function generateMetadata(props: PageProps<'/exam-boards/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const examBoard = await getExamBoard(id);
  if (!examBoard) {
    return {};
  }
  return {
    title: `${examBoard.name} — TAPS`,
    description: examBoard.description,
  };
}

export default async function ExamBoardHubPage(props: PageProps<'/exam-boards/[id]'>) {
  const { id } = await props.params;
  const examBoard = await getExamBoard(id);
  if (!examBoard) {
    notFound();
  }

  const posts = await getPostsByExamBoard(examBoard.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {examBoard.type === 'TEACHING' ? 'Teaching Exam' : 'Teacher Eligibility Test'}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{examBoard.name}</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">{examBoard.description}</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {hubSections(examBoard.id).map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            {section.label}
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
        {posts.length === 0 ? (
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            No notifications published for {examBoard.name} yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {posts.map((post) => (
              <li key={post.id} className="py-4">
                <h3 className="font-medium">{post.title}</h3>
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

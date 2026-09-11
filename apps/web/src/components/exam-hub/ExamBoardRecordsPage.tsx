import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getExamBoard } from '../../lib/api';
import type { ExamBoard } from '../../lib/types';

interface ExamBoardRecordsPageProps<T> {
  examBoardId: string;
  title: string;
  note: string;
  fetchItems: (examBoard: ExamBoard) => Promise<T[]>;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyMessage: (examBoard: ExamBoard) => string;
}

/**
 * Shared board-lookup/breadcrumb/notFound/empty-state scaffold for the exam
 * hub's Syllabus/Previous Papers/Study Material sub-pages (TAPS-3.6,
 * TAPS-3.8's endpoints) — the same layout `ExamBoardSubPage` uses for
 * Exam Pattern/Eligibility, but generic over the record shape instead of
 * rendering `Post` specifically: `Syllabus` (subject + topics),
 * `PastPaper` (subject + year + a file link), and `StudyMaterial` (title +
 * subject + a file link) are structured records with different fields
 * from each other and from `Post`, not article lists, so each page owns
 * its own `renderItem` rather than this component guessing a one-size
 * layout for all three.
 */
export async function ExamBoardRecordsPage<T>({
  examBoardId,
  title,
  note,
  fetchItems,
  getKey,
  renderItem,
  emptyMessage,
}: ExamBoardRecordsPageProps<T>) {
  const examBoard = await getExamBoard(examBoardId);
  if (!examBoard) {
    notFound();
  }

  const items = await fetchItems(examBoard);

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
        {items.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">{emptyMessage(examBoard)}</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {items.map((item) => (
              <li key={getKey(item)} className="py-4">
                {renderItem(item)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import Link from 'next/link';

export default function ExamBoardNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Exam board not found</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t find an exam board with that id.
      </p>
      <Link href="/" className="mt-6 inline-block underline">
        Back to home
      </Link>
    </div>
  );
}

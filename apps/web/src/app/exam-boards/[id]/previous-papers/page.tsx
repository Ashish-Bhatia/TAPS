import type { Metadata } from 'next';
import { ExamBoardRecordsPage } from '../../../../components/exam-hub/ExamBoardRecordsPage';
import { getExamBoard, getPastPapersByExamBoard } from '../../../../lib/api';

export async function generateMetadata(
  props: PageProps<'/exam-boards/[id]/previous-papers'>,
): Promise<Metadata> {
  const { id } = await props.params;
  const examBoard = await getExamBoard(id);
  if (!examBoard) {
    return {};
  }
  return {
    title: `${examBoard.name} Previous Papers — TAPS`,
    description: `Past papers for ${examBoard.name}.`,
  };
}

export default async function PreviousPapersPage(
  props: PageProps<'/exam-boards/[id]/previous-papers'>,
) {
  const { id } = await props.params;
  return (
    <ExamBoardRecordsPage
      examBoardId={id}
      title="Previous Papers"
      note="Past papers for this board, most recent year first, from the public past-papers API (TAPS-3.8)."
      fetchItems={(examBoard) => getPastPapersByExamBoard(examBoard.id)}
      getKey={(item) => item.id}
      emptyMessage={(examBoard) => `No past papers published for ${examBoard.name} yet.`}
      renderItem={(item) => (
        <>
          <h2 className="font-medium">
            {item.subject} — {item.year}
          </h2>
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Download paper
          </a>
        </>
      )}
    />
  );
}

import type { Metadata } from 'next';
import { ExamBoardRecordsPage } from '../../../../components/exam-hub/ExamBoardRecordsPage';
import { getExamBoard, getSyllabusByExamBoard } from '../../../../lib/api';

export async function generateMetadata(
  props: PageProps<'/exam-boards/[id]/syllabus'>,
): Promise<Metadata> {
  const { id } = await props.params;
  const examBoard = await getExamBoard(id);
  if (!examBoard) {
    return {};
  }
  return {
    title: `${examBoard.name} Syllabus — TAPS`,
    description: `Syllabus subjects and topics for ${examBoard.name}.`,
  };
}

export default async function SyllabusPage(props: PageProps<'/exam-boards/[id]/syllabus'>) {
  const { id } = await props.params;
  return (
    <ExamBoardRecordsPage
      examBoardId={id}
      title="Syllabus"
      note="Published syllabus subjects and topics for this board, from the public syllabus API (TAPS-3.8)."
      fetchItems={(examBoard) => getSyllabusByExamBoard(examBoard.id)}
      getKey={(item) => item.id}
      emptyMessage={(examBoard) => `No syllabus published for ${examBoard.name} yet.`}
      renderItem={(item) => (
        <>
          <h2 className="font-medium">{item.subject}</h2>
          {item.topics.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
              {item.topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          )}
        </>
      )}
    />
  );
}

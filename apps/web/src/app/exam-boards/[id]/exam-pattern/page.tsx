import type { Metadata } from 'next';
import { ExamBoardSubPage } from '../../../../components/exam-hub/ExamBoardSubPage';
import { getExamBoard } from '../../../../lib/api';

export async function generateMetadata(
  props: PageProps<'/exam-boards/[id]/exam-pattern'>,
): Promise<Metadata> {
  const { id } = await props.params;
  const examBoard = await getExamBoard(id);
  if (!examBoard) {
    return {};
  }
  return {
    title: `${examBoard.name} Exam Pattern — TAPS`,
    description: `Exam pattern articles for ${examBoard.name}.`,
  };
}

export default async function ExamPatternPage(props: PageProps<'/exam-boards/[id]/exam-pattern'>) {
  const { id } = await props.params;
  return (
    <ExamBoardSubPage
      examBoardId={id}
      title="Exam Pattern"
      note="Published exam-pattern articles for this board. Exam Pattern has no dedicated data model yet, so this list is the board's published articles generally — see the backlog (TAPS-3.8) for giving it a real category."
    />
  );
}

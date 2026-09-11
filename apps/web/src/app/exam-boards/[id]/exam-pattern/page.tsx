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
      category="exam-pattern"
      note="Published exam-pattern posts for this board, filtered by Post.category (TAPS-3.8). Requires an admin to have actually tagged posts with the &ldquo;exam-pattern&rdquo; category — until then this list may be empty even if the board has other published posts."
    />
  );
}

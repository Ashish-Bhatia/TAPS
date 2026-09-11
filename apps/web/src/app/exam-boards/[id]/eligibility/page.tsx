import type { Metadata } from 'next';
import { ExamBoardSubPage } from '../../../../components/exam-hub/ExamBoardSubPage';
import { getExamBoard } from '../../../../lib/api';

export async function generateMetadata(
  props: PageProps<'/exam-boards/[id]/eligibility'>,
): Promise<Metadata> {
  const { id } = await props.params;
  const examBoard = await getExamBoard(id);
  if (!examBoard) {
    return {};
  }
  return {
    title: `${examBoard.name} Eligibility — TAPS`,
    description: `Eligibility criteria articles for ${examBoard.name}.`,
  };
}

export default async function EligibilityPage(props: PageProps<'/exam-boards/[id]/eligibility'>) {
  const { id } = await props.params;
  return (
    <ExamBoardSubPage
      examBoardId={id}
      title="Eligibility"
      note="Published eligibility-criteria articles for this board. Eligibility has no dedicated data model yet, so this list is the board's published articles generally — see the backlog (TAPS-3.8) for giving it a real category."
    />
  );
}

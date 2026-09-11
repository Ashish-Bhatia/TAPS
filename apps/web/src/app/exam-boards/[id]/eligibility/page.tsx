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
      category="eligibility"
      note="Published eligibility-criteria posts for this board, filtered by Post.category (TAPS-3.8). Requires an admin to have actually tagged posts with the &ldquo;eligibility&rdquo; category — until then this list may be empty even if the board has other published posts."
    />
  );
}

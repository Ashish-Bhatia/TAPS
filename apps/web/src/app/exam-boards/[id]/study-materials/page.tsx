import type { Metadata } from 'next';
import { ExamBoardRecordsPage } from '../../../../components/exam-hub/ExamBoardRecordsPage';
import { getAllStudyMaterials, getExamBoard } from '../../../../lib/api';

export async function generateMetadata(
  props: PageProps<'/exam-boards/[id]/study-materials'>,
): Promise<Metadata> {
  const { id } = await props.params;
  const examBoard = await getExamBoard(id);
  if (!examBoard) {
    return {};
  }
  return {
    title: `${examBoard.name} Study Material — TAPS`,
    description: `Study material relevant to ${examBoard.name}.`,
  };
}

export default async function StudyMaterialsPage(
  props: PageProps<'/exam-boards/[id]/study-materials'>,
) {
  const { id } = await props.params;
  return (
    <ExamBoardRecordsPage
      examBoardId={id}
      title="Study Material"
      note="StudyMaterial has no exam-board field in the data model (docs/adr/013-post-category-field-and-content-endpoints.md) — it's organized by subject only. So this is the full study material catalog from the public study-materials API (TAPS-3.8), the same list on every board's page, not filtered to this board specifically."
      fetchItems={() => getAllStudyMaterials()}
      getKey={(item) => item.id}
      emptyMessage={() => 'No study material published yet.'}
      renderItem={(item) => (
        <>
          <h2 className="font-medium">{item.title}</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.subject}</p>
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Download
          </a>
        </>
      )}
    />
  );
}

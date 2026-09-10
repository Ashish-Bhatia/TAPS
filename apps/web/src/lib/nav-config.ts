// Primary navigation structure — mirrors the section ORDER and LABELS from
// docs/project-knowledge/03-SOURCE-SITE-CONTENT-INVENTORY.md's "Primary
// Navigation" list for structural parity. All labels/copy here are
// original phrasing, not copied from the source site (which this repo has
// no scraped text from in the first place — only this structural summary).
//
// "Teaching Exams" and "TET-Exams" are NOT listed here: their dropdown
// contents come from the live public API (getExamBoardsForNav in api.ts),
// not this static config — see docs/adr/007-nav-data-sourcing.md for why.
// Every other section links to a placeholder page for now — none of
// Syllabus/PastPaper/StudyMaterial/Book/New-Jobs has a public API yet
// (only ExamBoard/Post do, per TAPS-3.1); each placeholder route exists
// (see app/(placeholders)/) so these are real, working links that render a
// "coming soon" notice — never a silent 404.

export interface StaticNavItem {
  label: string;
  href: string;
}

export const staticNavItems: StaticNavItem[] = [
  { label: 'Syllabus', href: '/syllabus' },
  { label: 'Previous Years Papers', href: '/previous-papers' },
  { label: 'Study Materials', href: '/study-materials' },
  { label: 'New Jobs', href: '/new-jobs' },
  { label: 'NCERT Books', href: '/ncert-books' },
];

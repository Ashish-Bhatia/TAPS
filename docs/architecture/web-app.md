# `apps/web` — App Structure & Navigation

Covers `TAPS-3.2`. Next.js 16 App Router, `src/app/`. See
`docs/adr/007-nav-data-sourcing.md` for the navigation data-sourcing decision this doc assumes.

## Layout & navigation

`src/app/layout.tsx` is the root layout — an async Server Component that fetches the exam board
list once per request (`getExamBoardsForNav()`, `src/lib/api.ts`) and passes it to
`<Header examBoards={...} />`. Every page renders inside `<Header>` / `<Footer>` via this layout,
so no page needs to wire navigation itself.

- `src/components/nav/Header.tsx` — the primary mega-menu nav. The "Teaching Exams"/"TET-Exams"
  dropdowns are native `<details>`/`<summary>` (accessible and keyboard-operable without any
  client-side JS/hydration — appropriate for a header rendered on every single page of a
  content/SEO-focused site).
- `src/components/nav/Footer.tsx` — static/legal page links.
- `src/lib/nav-config.ts` — the static portion of the nav structure (labels/order for the
  non-exam-board categories).
- `src/lib/api.ts` — `apiFetch()` (thin fetch wrapper around `docs/api/public-content.md`) and
  `getExamBoardsForNav()` (fails soft to `[]` on any API error — see the ADR).

## Routing conventions

- Exam hub pages: `/exam-boards/[id]` (`TAPS-3.3`) — `ExamBoard.id`, not a slug; `ExamBoard` has no
  slug field (`docs/adr/006-public-content-api-shape.md`).
- Placeholder/"coming soon" routes for nav categories with no public API yet: `/syllabus`,
  `/previous-papers`, `/study-materials`, `/new-jobs`, `/ncert-books`, plus the footer's
  `/about`, `/contact`, `/disclaimer`, `/privacy` — all real, working routes (never a silent 404
  for a primary nav item), rendering `src/components/ui/ComingSoon.tsx`.
- `params` is a `Promise` in this Next.js version (breaking change from 14 and earlier) — always
  `await props.params`, and prefer the generated `PageProps<'/route'>`/`LayoutProps<'/route'>`
  type helpers over hand-written param types.

## Environment

`NEXT_PUBLIC_API_URL` — base URL of `apps/api`'s public content API. `NEXT_PUBLIC_`-prefixed
because the client-side search box (`TAPS-3.4`) calls it directly from the browser; it's a public
base URL, not a secret. Falls back to `http://localhost:8080` (the `apps/api` dev default) if
unset. See `apps/web/.env.example`.

## Testing

`apps/web` had no test runner before this story (`TAPS-1.11` tracked this as a gap). Added Vitest,
`@testing-library/react`, and jsdom (`apps/web/vitest.config.ts`), matching the Vitest choice
`apps/api` already established — consistent tooling across the monorepo rather than introducing
Jest. **Not** using `@testing-library/jest-dom`: its bundled vitest type augmentation didn't
type-check correctly against `vitest@5.0.0`'s `Assertion` type after two different fix attempts (a
tsconfig `types` array entry, then an explicit triple-slash reference) — see the commit history on
`TAPS-3.2` for the two-strike loop-prevention note. Tests use plain DOM assertions
(`element.getAttribute(...)`, `toBeTruthy()`) instead, which need no extra typings.

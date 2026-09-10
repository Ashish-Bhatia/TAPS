# `apps/web` — App Structure & Navigation

Covers `TAPS-3.2`, `TAPS-3.3`, and `TAPS-3.4`. Next.js 16 App Router, `src/app/`. See
`docs/adr/007-nav-data-sourcing.md` for the navigation data-sourcing decision,
`docs/adr/008-web-api-fetch-caching.md` for the API fetch caching decision, and
`docs/adr/009-full-text-search.md` for the search ranking decision this doc assumes.

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
- `src/lib/api.ts` — `apiFetch()` (thin fetch wrapper around `docs/api/public-content.md`,
  `getExamBoardsForNav()` (fails soft to `[]` on any API error — see ADR 007), and
  `getExamBoard(id)`/`getPostsByExamBoard(examBoardId)` for the exam hub page (`TAPS-3.3`) — these
  do NOT fail soft, since the hub page's own content genuinely depends on them; a real API error
  should surface as an error, not a page that looks fine but is silently missing its content.
  `getExamBoard` returns `null` specifically for a `404`, which the page turns into Next's
  `notFound()`.

## Data fetching & caching

Every `apps/web` → `apps/api` fetch uses `cache: 'no-store'` — no `next.revalidate` anywhere. This
was not the original design (ISR-style `revalidate: 300` caching was tried first) — see
`docs/adr/008-web-api-fetch-caching.md` for the real bug that caused the switch (a stale/empty
cached response that survived full dev-server restarts) and its accepted consequence (every route
is now server-rendered per-request rather than statically pre-rendered).

## Routing conventions

- Exam hub pages: `/exam-boards/[id]` (`TAPS-3.3`) — `ExamBoard.id`, not a slug; `ExamBoard` has no
  slug field (`docs/adr/006-public-content-api-shape.md`). `generateMetadata` sets the page
  title/description from the fetched `ExamBoard`; a segment-level `not-found.tsx` renders when
  `getExamBoard` returns `null`.
- The hub page's "Syllabus / Exam Pattern / Previous Papers / Study Material / Eligibility"
  sub-section links (per the "Exam Hub page" type in
  `03-SOURCE-SITE-CONTENT-INVENTORY.md`) route to the generic placeholder pages below, not
  per-board routes — none of those models have a public API yet (only `ExamBoard`/`Post` do).
  Becoming board-specific (e.g. `/exam-boards/[id]/syllabus`) is a natural follow-up once they do.
- Placeholder/"coming soon" routes for nav categories and hub sub-sections with no public API yet:
  `/syllabus`, `/exam-pattern`, `/previous-papers`, `/study-materials`, `/eligibility`,
  `/new-jobs`, `/ncert-books`, plus the footer's `/about`, `/contact`, `/disclaimer`, `/privacy` —
  all real, working routes (never a silent 404 for a primary nav item or hub section), rendering
  `src/components/ui/ComingSoon.tsx`.
- `params` is a `Promise` in this Next.js version (breaking change from 14 and earlier) — always
  `await props.params`, and prefer the generated `PageProps<'/route'>`/`LayoutProps<'/route'>`
  type helpers over hand-written param types. `searchParams` is a `Promise` too (`/search`, below).
- `/search` (`TAPS-3.4`): reads `?q=` from `searchParams`, calls the search API
  (`docs/api/public-content.md`, ranking explained in `docs/adr/009-full-text-search.md`). The
  nav's search box (`Header.tsx`) is a plain `<form action="/search" role="search">` — a GET
  submit that navigates the browser, no client JS/hydration needed, same philosophy as the
  `<details>` dropdowns. A search result for a `Post` links to its parent `ExamBoard`'s hub page
  (where the post already appears — `TAPS-3.3`) rather than a dedicated post-detail page, which
  doesn't exist in `apps/web` yet.

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

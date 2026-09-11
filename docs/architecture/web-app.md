# `apps/web` — App Structure & Navigation

Covers `TAPS-3.2`, `TAPS-3.3`, `TAPS-3.4`, and `TAPS-3.6`. Next.js 16 App Router, `src/app/`. See
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
is now server-rendered per-request rather than statically pre-rendered). `TAPS-3.5` (below)
re-verified this decision against Next.js 16's actual current caching defaults and found it still
correct, with guidance for the user-specific fetches `EPIC 5` is about to add.

## Data Cache audit (`TAPS-3.5`)

`TAPS-3.5` re-investigated the above decision against Next.js 16.3.4's real, current behavior —
read straight from `node_modules/next/dist/docs/` (the docs bundled with the exact installed
version, per `apps/web/AGENTS.md`'s warning not to assume this Next.js behaves like older
training-data versions), not assumed from Next 13/14 conventions.

**What actually changed in Next.js 16 vs. 13/14:** in 13/14, `fetch()` was cached (`force-cache`)
by default. In Next 16 — and this app doesn't set the `cacheComponents` flag in
`next.config.ts`, so it's on the "Previous Model" both these docs describe, not Cache Components —
a bare `fetch()` with no `cache` option is **also not cached by default** ("`auto no cache`" per
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md`): every request
refetches in dev; in a production build it fetches once at build time only if the route can be
statically prerendered (no Request-time API reached first), and refetches on every request once a
Request-time API is used earlier in the tree
(`.../01-app/02-guides/caching-without-cache-components.md`).

**Fetch-by-fetch audit — every `apps/web` → `apps/api` call:**

| Call site                                                                                  | Option              | Verdict               |
| ------------------------------------------------------------------------------------------ | ------------------- | --------------------- |
| `apiFetch()` (`lib/api.ts`) — backs `getExamBoardsForNav`, `getPostsByExamBoard`, `search` | `cache: 'no-store'` | Dynamic, correctly so |
| `getExamBoard()`'s standalone fetch (`lib/api.ts`)                                         | `cache: 'no-store'` | Dynamic, correctly so |

A repo-wide search confirmed these are the _only_ two `fetch()` call sites in `apps/web/src` —
every page goes through one of them, none fetches `apps/api` directly, and no page/layout exports
a `revalidate`, `dynamic`, or `fetchCache` route segment config. **0 of these are caching when
they should be dynamic** — there is no stale-content risk today; every response is live. No code
changes were needed.

**Is `cache: 'no-store'` still the right call?** Yes, confirmed rather than assumed. Even though
Next 16's own bare default is now "not cached" in the loose sense above, it still differs from
`no-store` in the one way that matters here: the bare default serves a build-time snapshot on
every request for any route Next can statically prerender — exactly the kind of caching that made
a just-published `Post` invisible in ADR-008's original bug. Only explicit `cache: 'no-store'`
guarantees a live round-trip on every production request, so ADR-008's decision stands unchanged.

**The real, still-open cost — dynamic where it could safely cache:** every request, including
fully static placeholder pages (`/about`, `/privacy`, etc. — see `ComingSoon.tsx`), round-trips to
`apps/api` because the root layout's nav fetch (`getExamBoardsForNav`) is uncached on _every_
page. This is unnecessary DB load, not a correctness bug, and it's the same trade-off ADR-008
already named and accepted deliberately — not a new finding. Reintroducing caching safely for this
means tag-based invalidation (`next.tags` + `revalidateTag`) fired from `apps/api`'s admin write
endpoints on `ExamBoard`/`Post` writes, which needs `apps/api` to call back into `apps/web` (a new
authenticated revalidation route + cross-service wiring) — non-trivial and out of this
investigation's scope. Filed as `TAPS-3.7` (`docs/backlog/BACKLOG.md`), not fixed here.

**Guidance for `EPIC 5`'s upcoming user-specific dashboard/quiz-attempt pages:** nothing needs to
change defensively before `EPIC 5` lands — every current fetch already re-fetches live on every
request, which is the safe default for per-user data too. One sharp edge worth flagging now for
whoever builds `EPIC 5`'s authenticated fetches: `fetch.md`'s reference is explicit that caching is
opt-in — `cache: 'force-cache'` "will cache any request, including... requests that send
`authorization` or `cookie` headers." So the first session-scoped fetch (a user's dashboard/quiz
attempts) must stay on `cache: 'no-store'` (or a `next.tags`-tagged, per-user cache key if caching
is ever deliberately wanted there) — never `force-cache` or a bare `next.revalidate`, or one user's
response can be served back to another user by Next's own persistent fetch cache.

## Routing conventions

- Exam hub pages: `/exam-boards/[id]` (`TAPS-3.3`) — `ExamBoard.id`, not a slug; `ExamBoard` has no
  slug field (`docs/adr/006-public-content-api-shape.md`). `generateMetadata` sets the page
  title/description from the fetched `ExamBoard`; a segment-level `not-found.tsx` renders when
  `getExamBoard` returns `null`.
- The hub page's "Syllabus / Exam Pattern / Previous Papers / Study Material / Eligibility"
  sub-section links, per the "Exam Hub page" type in `03-SOURCE-SITE-CONTENT-INVENTORY.md`: all
  five are now real board-specific routes (`TAPS-3.6`, completed once `TAPS-3.8`'s public
  endpoints/`Post.category` field existed — see `docs/adr/013-post-category-field-and-content-endpoints.md`).
  - **Exam Pattern / Eligibility** — `/exam-boards/[id]/exam-pattern` and
    `/exam-boards/[id]/eligibility` (`src/components/exam-hub/ExamBoardSubPage.tsx`, shared by
    both). Each passes its own `category` prop (`"exam-pattern"` / `"eligibility"`) through to
    `getPostsByExamBoard(examBoardId, category)`, which now filters server-side on `Post.category`
    (`TAPS-3.8`) instead of the earlier `filterArticles` client-side `PostType` filter both pages
    used to share (removed — no longer needed now that a real category field exists). This makes
    the two pages genuinely capable of showing different content, but the split only becomes
    visible once an admin actually tags posts with `"exam-pattern"`/`"eligibility"` categories —
    the pages are correct against `TAPS-3.8`'s API even though the current seed data isn't yet
    tagged that way (a content/seed gap, not a code defect); until then either or both may render
    an empty list even when the board has other published posts.
  - **Syllabus / Previous Papers** — `/exam-boards/[id]/syllabus` and
    `/exam-boards/[id]/previous-papers`, both backed by `src/components/exam-hub/ExamBoardRecordsPage.tsx`
    (a _different_ shared component from `ExamBoardSubPage`, deliberately — `Syllabus` and
    `PastPaper` are structured records, not article lists, so force-fitting them through
    `ExamBoardSubPage`'s `Post`-shaped rendering would mean either dropping their real fields
    (`topics`, `year`, `fileUrl`) or contorting them to look like posts. `ExamBoardRecordsPage`
    instead only owns the parts that generalize — the board lookup/breadcrumb/`notFound()`/
    empty-state scaffold — and takes `fetchItems`/`getKey`/`renderItem`/`emptyMessage` props so
    each page renders its own record shape. Both call `getSyllabusByExamBoard(examBoardId)` /
    `getPastPapersByExamBoard(examBoardId)` (`src/lib/api.ts`), which filter
    `/public/syllabus`/`/public/past-papers` by `examBoardId` — both models carry that FK.
  - **Study Material** — `/exam-boards/[id]/study-materials`, also on `ExamBoardRecordsPage`, but
    calling `getAllStudyMaterials()` with **no board filter**: `StudyMaterial` has no `examBoardId`
    field at all (confirmed against the Prisma model — it's organized by `subject` only, see the
    ADR above), so there is no real per-board scoping to apply. This page fetches the full catalog
    and says so in its note, rather than inventing a board relationship the schema doesn't have —
    every board's `/study-materials` page currently renders the same list, which is a genuine data
    model limitation, not a bug in this page.
- Placeholder/"coming soon" routes for nav categories with no public API/board scoping (nav-level,
  not the hub sub-sections above): `/syllabus`, `/previous-papers`, `/study-materials`,
  `/new-jobs`, `/ncert-books`, plus the footer's `/about`, `/contact`, `/disclaimer`, `/privacy` —
  all real, working routes (never a silent 404 for a primary nav item), rendering
  `src/components/ui/ComingSoon.tsx`. The standalone (non-board) `/exam-pattern` and `/eligibility`
  placeholder routes from `TAPS-3.2` still exist too (harmless, reachable by direct URL) but are no
  longer linked from anywhere now that the hub page points at the board-specific pages above.
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

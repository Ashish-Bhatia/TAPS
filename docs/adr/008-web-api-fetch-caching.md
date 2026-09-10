# 008 — apps/web's API fetches are uncached (`cache: 'no-store'`)

Status: Accepted

## Context

`TAPS-3.3`'s exam hub page (`apps/web/src/app/exam-boards/[id]/page.tsx`) is the first page to
render data that changes through the admin CRUD API during normal use (a `Post`, published via
`TAPS-2.3`'s admin endpoints). Building it surfaced a real bug that mocked unit tests never
would: `apps/web/src/lib/api.ts`'s original `apiFetch()` used `next: { revalidate: 300 }`
(Next.js's ISR-style fetch caching, matching what `TAPS-3.2` set up for the nav's exam-board
list). With that, publishing a new post via the admin API never showed up on its board's hub
page — the fetch consistently returned a stale, empty result.

This wasn't ordinary 5-minute staleness. It was reproduced and confirmed structurally different:

- The stale result survived a **full `apps/web` dev server restart** and a **fully deleted
  `.next` directory** (`rm -rf .next`) — ruling out an on-disk or in-memory cache tied to that
  process's lifetime.
- Calling the exact same `getPostsByExamBoard()`/`getExamBoard()` functions **outside Next's
  request context**, via a plain `node` script hitting the same URLs, returned the correct,
  live data every time — ruling out a bug in this repo's own fetch/parsing logic.
- Adding `cache: 'no-store'` in place of `next: { revalidate: 300 }` fixed it immediately and
  reliably, repeated across create and delete operations.

This points at a caching bug in Next.js 16.3.4's (Turbopack, dev mode) Data Cache implementation
itself, not application code — but per loop-prevention rule 1, two structurally different
diagnostic angles (both ruling out this repo's code) were enough to stop chasing the framework's
internals and fix the symptom directly rather than the (out-of-scope) root cause.

## Decision

**Every fetch to `apps/api`'s public content API from `apps/web` uses `cache: 'no-store'`** —
`apiFetch()` in `lib/api.ts`, and `getExamBoard()`'s standalone fetch. No `next.revalidate` option
anywhere in this file. Verified live: creating, and separately deleting, a `Post` via the admin
API is reflected on the exam hub page on the very next request, with no manual cache-busting.

**Consequence accepted, not silently absorbed:** every route in `apps/web` is now server-rendered
per-request (`ƒ Dynamic` in `next build`'s route summary) rather than some being statically
pre-rendered at build time — including pages like `/about`/`/disclaimer` that don't themselves
need per-request freshness, because they sit under the root layout, which does an uncached fetch
for the nav on every request. This is a real, if minor, performance cost for a low-traffic MVP,
traded for correctness (never showing stale admin-published content) — the right trade for this
stage, revisited below.

## Consequences

- **Easier:** content published through the admin API is always immediately visible on the public
  site — no confusing "I published this five minutes ago and it's still not showing" reports, and
  no manual cache-invalidation logic to build and maintain.
- **Harder:** no static pre-rendering anywhere in `apps/web` yet, so every request round-trips to
  `apps/api`. Acceptable now (an admin/CMS-backed MVP with modest traffic, and `apps/api` is
  already fast for these simple queries); revisit once real traffic or Fly.io cold-start latency
  makes it worth reintroducing caching deliberately (e.g. via `revalidateTag`/`revalidatePath`
  triggered from the admin API on write, once that's built, rather than a blind time-based
  revalidate window that this bug already showed can't be trusted blindly).
- Tracked as a new backlog follow-up: investigate the actual root cause in Next.js's Data Cache
  (file an upstream issue if it reproduces on a minimal repro) before ever reintroducing
  `next.revalidate` in this app.

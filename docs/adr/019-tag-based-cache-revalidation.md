# 019 — Tag-based cache revalidation for static/shared `apps/web` content

Status: Accepted

## Context

`docs/adr/008-web-api-fetch-caching.md` (confirmed still correct under Next 16 by `TAPS-3.5`,
`docs/architecture/web-app.md`'s "Data Cache audit") made every `apps/web` → `apps/api` fetch
`cache: 'no-store'`, for good reason: a time-based `next.revalidate` window previously served
stale/empty content that survived full dev-server restarts. The accepted cost was real but minor:
every request, including fully static placeholder pages, round-trips to `apps/api` because the
root layout's nav fetch (`getExamBoardsForNav`) is uncached on every page. `TAPS-3.7` closes that
gap for the specific content that's genuinely static/shared (the nav's exam-board list, and a
board's own detail/posts) — everything else (search, syllabus, past papers, study materials, the
authenticated dashboard) stays exactly as `no-store` as before; this is not a reversal of ADR-008.

## Decision

**Tag-based caching, invalidated on write, not a time window.** The three call sites this story
scopes in (`getExamBoardsForNav`, `getExamBoard`, `getPostsByExamBoard` — `apps/web/src/lib/api.ts`)
now use `cache: 'force-cache'` + `next: { tags: [...] }` instead of `no-store`. Caching in Next's
Data Cache is opt-in (confirmed reading `node_modules/next/dist/docs/.../fetch.md`, matching
`apps/web/AGENTS.md`'s warning not to assume older-Next behavior): `next.tags` alone doesn't cache
anything without `cache: 'force-cache'` alongside it. `apiFetch()` (the shared wrapper multiple
functions use, including `search()`) took an optional `tags` parameter rather than changing its
default, so caching stays explicitly per-call-site opt-in — `search()` deliberately never passes it.

**Tags:**

- `exam-boards` — the nav list
- `exam-board-<id>` — one board's detail page
- `posts-<examBoardId>` — one board's post list (shared by the hub page and its Exam
  Pattern/Eligibility sub-pages, all calling `getPostsByExamBoard` with the same `examBoardId`)

**Invalidation: `apps/api` calls back into `apps/web`.** `ExamBoardService`/`PostService`
(`apps/api/src/{exam-board,post}/*.service.ts`) call a new `RevalidationService` after every
successful `create`/`update`/`remove`, which `POST`s the affected tags to a new
`apps/web` Route Handler, `POST /api/revalidate` (`apps/web/src/app/api/revalidate/route.ts`),
authenticated by a shared secret (`REVALIDATION_SECRET`, new on both apps — never the admin JWT,
which the caller has no legitimate reason to hold). That route calls
`revalidateTag(tag, { expire: 0 })` — the two-argument form (the single-argument form is
deprecated per `node_modules/next/dist/docs/.../revalidateTag.md`, verified before writing this
rather than assumed from older training data) — `{ expire: 0 }` specifically, not the docs'
`profile: 'max'` example, because that profile is for Server Actions invalidating their own
just-written data; a cross-service webhook call has no `updateTag` available and wants the data
gone now, which `{ expire: 0 }` is the documented way to get.

**Revalidation calls fail soft.** `RevalidationService.revalidate()` never throws: if
`REVALIDATION_SECRET` isn't configured (e.g. local dev without it set), it skips silently; if the
HTTP call fails or `apps/web` is unreachable, it logs and returns. The DB write that triggered it
already succeeded — turning a caching-infrastructure hiccup into a 500 on an otherwise-successful
admin action would be strictly worse than the cache staying stale a little longer.

**No shared package for the tag-name strings.** `apps/web` and `apps/api` communicate only over
HTTP in this repo (no `packages/*` workspace is actually used despite being in the root
`workspaces` glob) — introducing one just to share three string-template functions would be new
infrastructure beyond this story's scope. Both sides construct identical tag strings independently
(`EXAM_BOARDS_TAG`/`examBoardTag`/`postsTag` in `apps/web/src/lib/api.ts`, duplicated in
`apps/api/src/exam-board/exam-board.service.ts` and `apps/api/src/post/post.service.ts`) — a real,
accepted maintenance cost: if this naming ever changes, both sides need updating by hand, and
there's no compiler to catch a mismatch. Comments on both sides point at each other.

**Known limitation, accepted, not fixed here:** if a `Post` update moves it to a different
`examBoardId`, only the new board's tag is revalidated — the old board's cached post list would
need a fetch-before-update to know the prior value. This is a caching-optimization edge case (the
old list self-heals whenever that board next gets any other write), not a correctness bug, so it's
documented rather than built around (loop-prevention rule 3).

## Consequences

- **Easier:** fully static pages no longer round-trip to `apps/api` on every request; admin-edited
  `ExamBoard`/`Post` content is still correct within roughly one request of being written (the tag
  is invalidated synchronously as part of the same admin write's response, not on a delay).
- **Harder:** two new founder-only secrets (`REVALIDATION_SECRET` on both Vercel and Fly,
  `WEB_APP_URL` on Fly) — see `apps/api/.env.example` and `apps/web/.env.example`. Until set,
  everything still works correctly (revalidation calls just no-op), so this doesn't block a
  deploy the way `TAPS-1.22`'s smoke-test secrets did — it only means the cache doesn't get the
  new invalidation-on-write behavior until they're configured.
- A revalidation call is one more network hop off the critical path of every admin
  create/update/delete on `ExamBoard`/`Post` — mitigated by not blocking the response on
  `RevalidationService`'s success (a failure is only logged), but it is still `await`ed before the
  HTTP response returns, so a slow/unreachable `apps/web` measurably slows (not breaks) an admin
  write. Acceptable for this stage's traffic; revisit (e.g. fire-and-forget without awaiting) if
  it becomes a real latency problem.

## Verification — live, not mocked

The committed test suite (both apps) is entirely unit-level: fetch mocked, `revalidateTag` mocked,
Prisma mocked. `docs/adr/008-web-api-fetch-caching.md`'s own bug was explicitly **not** caught by
tests at that level — only a live reproduction found it — so mocked coverage alone isn't enough
evidence that `force-cache` + `next.tags` + `revalidateTag` actually behaves as documented on this
installed Next.js 16.3.4. Before recommending this PR for merge, the real mechanism was exercised
end-to-end against a real running server, no mocks:

1. Built `apps/web` with `next build` (production mode — dev mode's caching semantics differ) and
   ran it with `next start`, `NEXT_PUBLIC_API_URL` pointed at a throwaway local HTTP server that
   serves `/public/exam-boards` and counts how many times it's actually hit.
2. Requested `/` (which renders via `getExamBoardsForNav`, tagged `exam-boards`) twice. Upstream
   hit count stayed at **1** across both requests — real proof `force-cache` + `next.tags` actually
   caches on this Next.js version, not just that the code compiles.
3. `POST /api/revalidate` with the real secret and `{"tags":["exam-boards"]}` — got back
   `{"revalidated":true,"tags":["exam-boards"]}`.
4. Requested `/` again: upstream hit count went **1 → 2**, exactly at that request — real proof
   `revalidateTag(tag, { expire: 0 })` genuinely invalidates the cache entry the tag was attached
   to, closing the specific gap ADR-008's bug exposed (a caching mechanism that looked correct in
   code but wasn't, in this framework's actual behavior).
5. Auth boundary checked live too: `POST /api/revalidate` with a wrong secret → real `401`, and the
   cache stayed warm (hit count unchanged) — a rejected call doesn't accidentally poison or refetch
   anything.

Throwaway build artifacts and the local test servers were discarded after — this section is the
evidence trail, not a reproducible test (the committed, mocked unit tests are what CI runs).

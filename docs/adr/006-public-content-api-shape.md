# 006 — Public content API: module boundary, identifiers, pagination

Status: Accepted

## Context

`TAPS-3.1` adds unauthenticated, read-only `ExamBoard`/`Post` endpoints for `apps/web` to consume.
Three choices here have real trade-offs.

**1. Where the public routes live.** The admin `ExamBoardController`/`PostController` (`TAPS-2.3`)
already exist, fully CRUD, gated by `JwtAuthGuard` on the whole controller. Adding public GET
routes to those same controllers would mean either splitting guard behavior per-method (some
routes on a `@UseGuards`-decorated controller guarded, some not — easy to get wrong, and one typo
away from an admin mutation route losing its guard) or duplicating the controllers anyway.

**2. What identifies a single record in a public URL.** `Post.slug` is unique and already indexed
for exactly this (`docs/adr/004-content-schema-design.md`). `ExamBoard` has no `slug` field — only
a unique `name`. Both work as a public identifier, but they're not the same _kind_ of identifier
(a slug is human-readable/URL-friendly by design, `name` is not guaranteed to be — "DSSSB" happens
to be, but that's incidental, not a modeled invariant).

**3. Pagination shape.** No existing endpoint in this repo paginates yet (`TAPS-2.3`'s admin lists
return a bare array). A public content API — potentially serving hundreds of posts as more content
gets created — needs it from the start rather than retrofitted later.

## Decisions

**A new `PublicContentModule`** (`apps/api/src/public-content/`), entirely separate from the admin
`ExamBoardModule`/`PostModule` — `PublicExamBoardsController`/`PublicPostsController`, under
`/public/exam-boards` and `/public/posts`, with no `@UseGuards` at all. Structural separation means
there's no per-method guard bookkeeping to get wrong: nothing under `/public/*` can accidentally
require a JWT, and nothing under the admin routes can accidentally skip one, because they're
different classes entirely, not different methods on the same one.

**`ExamBoard` single-record lookup is by `id`; `Post` is by `slug`.** Each uses its own real unique
identifier rather than inventing a `slug` field on `ExamBoard` just for symmetry — with only 6
exam boards and no product requirement yet for pretty exam-board URLs, adding a field to satisfy
API-shape symmetry would be speculative. If `apps/web`'s exam hub routing (`TAPS-3.3`) turns out to
want prettier board URLs, that's a real, separately-scoped follow-up once it's an actual need.

**Pagination**: a shared `PaginationQueryDto` (`page`/`pageSize`, defaults 1/20, `pageSize` capped
at 100) and a `Paginated<T>` envelope (`{ data, page, pageSize, total, totalPages }`), used
identically by both public list endpoints — and reusable by `TAPS-3.4`'s search endpoint. Capping
`pageSize` at 100 prevents a client from requesting the entire table in one request once content
volume grows.

**Public `Post` endpoints only ever return published posts** (`publishedAt` set and not in the
future) — a draft post's `slug` isn't secret, but it also isn't meant to be publicly fetchable
just because someone knows or guesses it. Verified live against Neon: a draft, a past-dated
published post, and a future-dated post were created via the admin API; the public list and
public by-slug lookup surfaced only the past-dated one (draft and future both `404` on direct
slug lookup, both absent from the list) — then all three were deleted, leaving no residue.

## Consequences

- **Easier:** the admin/public boundary is structural, not a per-route decorator to remember;
  adding a new public field or endpoint later can't accidentally leak an admin mutation route.
  `TAPS-3.4`'s search endpoint gets the same pagination shape for free.
- **Harder:** `ExamBoard` and `Post` now have differently-shaped detail URLs (`/public/exam-boards/:id`
  vs `/public/posts/:slug`) — a minor API-surface inconsistency, documented rather than papered
  over with a field that doesn't earn its keep yet.

## Addendum (`TAPS-3.3`): `?examBoardId=` filter bug, found live and fixed

The original `PublicPostsController.findAll` bound the query string to two separate `@Query()`
params — `@Query() pagination: PaginationQueryDto` plus a standalone `@Query('examBoardId')`. The
global `ValidationPipe`'s `forbidNonWhitelisted: true` validates the _entire_ incoming query
object against whichever DTO class is attached to a `@Query()` param, so `?examBoardId=...` was
rejected with `400 property examBoardId should not exist` — the two decorators don't know about
each other, and `PaginationQueryDto` never declared `examBoardId`. `TAPS-3.1`'s own manual
verification never exercised this exact combination (pagination + the filter together), so it
shipped unnoticed until `TAPS-3.3`'s exam hub page became the filter's first real caller. Fixed by
declaring every accepted query field on one DTO (`ListPostsQueryDto extends PaginationQueryDto`,
`apps/api/src/public-content/dto/list-posts-query.dto.ts`) bound via a single `@Query()`.

# Public Content API

Unauthenticated, read-only (`TAPS-3.1`, extended by `TAPS-3.8`) — for `apps/web` to consume. See
`docs/adr/006-public-content-api-shape.md` for why this is a separate module/controller set from
the admin CRUD in `docs/api/exam-boards.md`/`docs/api/posts.md`, rather than public routes bolted
onto those, and `docs/adr/013-post-category-field-and-content-endpoints.md` for the `Syllabus`/
`PastPaper`/`StudyMaterial` endpoints and `Post.category` added in `TAPS-3.8`.

## Pagination

Every list endpoint below shares the same shape:

- **Query:** `?page=<n>` (default `1`), `?pageSize=<n>` (default `20`, max `100`)
- **Response:** `{ data: T[], page, pageSize, total, totalPages }`
- **Errors:** `400 Bad Request` — `page`/`pageSize` not a positive integer, or `pageSize` over 100

## `GET /public/exam-boards`

- **Response:** `200 OK`, paginated `ExamBoard[]`, ordered by `name` ascending

## `GET /public/exam-boards/:id`

- **Response:** `200 OK`, the `ExamBoard`
- **Errors:** `404 Not Found` — no exam board with that id

## `GET /public/posts`

- **Query:** `?examBoardId=<id>` and/or `?category=<value>` — both optional filters (combinable),
  plus the pagination params above. `category` matches `Post.category` (`TAPS-3.8`) — a free-form
  string, not an enum (see the ADR); there is no fixed list of valid values to validate against,
  so an unrecognized category simply matches nothing rather than `400`ing.
- **Response:** `200 OK`, paginated `Post[]`, ordered by `publishedAt` descending
- **Only published posts are ever returned** — a `Post` with `publishedAt` unset (draft) or in the
  future is excluded, even if its exam board/id/slug is known. See the admin
  `docs/api/posts.md` for the authenticated CRUD that manages drafts/publishing.

## `GET /public/posts/:slug`

- **Response:** `200 OK`, the `Post` — looked up by `slug`, not `id` (see the ADR for why)
- **Errors:** `404 Not Found` — no _published_ post with that slug (a draft's slug also 404s here,
  deliberately — see "Only published posts" above)

## `GET /public/syllabus`

- **Query:** `?examBoardId=<id>` and/or `?subject=<subject>` — both optional filters (combinable),
  plus the pagination params above
- **Response:** `200 OK`, paginated `Syllabus[]`, ordered by `subject` ascending

## `GET /public/syllabus/:id`

- **Response:** `200 OK`, the `Syllabus` — looked up by `id` (no slug-like identifier exists on
  this model, so this matches `ExamBoard`'s by-`id` lookup rather than `Post`'s by-`slug` one)
- **Errors:** `404 Not Found` — no syllabus with that id

## `GET /public/past-papers`

- **Query:** `?examBoardId=<id>`, `?subject=<subject>`, `?year=<n>` — all optional filters
  (combinable), plus the pagination params above
- **Response:** `200 OK`, paginated `PastPaper[]`, ordered by `year` descending then `subject`
  ascending
- **Errors:** `400 Bad Request` — `year` not an integer

## `GET /public/past-papers/:id`

- **Response:** `200 OK`, the `PastPaper` — looked up by `id`
- **Errors:** `404 Not Found` — no past paper with that id

## `GET /public/study-materials`

- **Query:** `?subject=<subject>` — optional filter, plus the pagination params above. **No
  `examBoardId` filter** — unlike `Syllabus`/`PastPaper`, `StudyMaterial` has no `examBoardId`
  field at all; it is organized by `subject` only (see the ADR and `05-ARCHITECTURE.md` §4).
- **Response:** `200 OK`, paginated `StudyMaterial[]`, ordered by `subject` ascending then `title`
  ascending

## `GET /public/study-materials/:id`

- **Response:** `200 OK`, the `StudyMaterial` — looked up by `id`
- **Errors:** `404 Not Found` — no study material with that id

## `GET /public/search`

Postgres full-text search (`tsvector`/`ts_rank`, not Meilisearch — per `05-ARCHITECTURE.md`) across
published `Post`s and `ExamBoard`s. See `docs/adr/009-full-text-search.md` for how ranking works.

- **Query:** `?q=<text>` (required), plus the pagination params above
- **Response:** `200 OK`, paginated results:
  `{ type: 'post' | 'exam-board', id, title, examBoardId, rank }[]`, ordered by `rank` descending.
  `examBoardId` is the parent board's id for a `'post'` result with one (`null` otherwise, and
  always `null` for `'exam-board'` results) — lets a client link a post result somewhere real
  (its board's hub page) without a dedicated public post-detail page existing yet. A query
  matching nothing returns `200` with `data: []` — not an error.
- **Errors:** `400 Bad Request` — `q` missing or empty
- Accepts free-form query syntax (quoted phrases, `OR`, `-excluded` terms — via Postgres's
  `websearch_to_tsquery`) without ever erroring on malformed input.
- Only published posts are searchable, same rule as `GET /public/posts` above.

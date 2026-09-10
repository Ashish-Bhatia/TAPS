# Public Content API

Unauthenticated, read-only (`TAPS-3.1`) — for `apps/web` to consume. See
`docs/adr/006-public-content-api-shape.md` for why this is a separate module/controller set from
the admin CRUD in `docs/api/exam-boards.md`/`docs/api/posts.md`, rather than public routes bolted
onto those.

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

- **Query:** `?examBoardId=<id>` — optional filter, plus the pagination params above
- **Response:** `200 OK`, paginated `Post[]`, ordered by `publishedAt` descending
- **Only published posts are ever returned** — a `Post` with `publishedAt` unset (draft) or in the
  future is excluded, even if its exam board/id/slug is known. See the admin
  `docs/api/posts.md` for the authenticated CRUD that manages drafts/publishing.

## `GET /public/posts/:slug`

- **Response:** `200 OK`, the `Post` — looked up by `slug`, not `id` (see the ADR for why)
- **Errors:** `404 Not Found` — no _published_ post with that slug (a draft's slug also 404s here,
  deliberately — see "Only published posts" above)

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

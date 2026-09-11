# Posts

Admin-only CMS CRUD for `Post` (TAPS-2.3). Every route requires `Authorization: Bearer
<accessToken>` from `POST /auth/login` (see `docs/api/auth.md`) — same admin/CMS-only scope note
as `docs/api/exam-boards.md`.

All routes: `401 Unauthorized` if the bearer token is missing/invalid/expired.

**Side effect (`TAPS-3.7`):** every successful `POST`/`PATCH`/`DELETE` here revalidates
`apps/web`'s tagged cache for the affected `examBoardId`'s post list (soft-fails if unconfigured
or unreachable — never blocks the write itself). See
`docs/adr/019-tag-based-cache-revalidation.md`.

## `POST /posts`

- **Body:** `CreatePostDto`:
  - `type: 'NOTIFICATION' | 'ARTICLE'`, `title: string`, `body: string` — required
  - `slug: string` — required, lowercase kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), unique
  - `examBoardId?: string`, `heroImage?: string` (URL), `publishedAt?: string` (ISO 8601) —
    optional; a post with no `examBoardId` isn't tied to a specific exam board (per
    `docs/architecture/data-model.md`), and no `publishedAt` means a draft
- **Response:** `201 Created`, the created `Post`
- **Errors:** `400 Bad Request` (validation), `409 Conflict` — `slug` already in use

## `GET /posts`

- **Query:** `?examBoardId=<id>` — optional filter
- **Response:** `200 OK`, `Post[]`, ordered by `createdAt` descending

## `GET /posts/:id`

- **Response:** `200 OK`, the `Post`
- **Errors:** `404 Not Found`

## `PATCH /posts/:id`

- **Body:** `UpdatePostDto` — any subset of `CreatePostDto`'s fields
- **Response:** `200 OK`, the updated `Post`
- **Errors:** `400 Bad Request` (validation), `404 Not Found`, `409 Conflict` (slug collision)

## `DELETE /posts/:id`

- **Response:** `204 No Content`
- **Errors:** `404 Not Found`

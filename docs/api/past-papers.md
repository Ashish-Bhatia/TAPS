# Past Papers

Admin-only CMS CRUD for `PastPaper` (TAPS-2.3's pattern, applied here by `TAPS-4.0`). Every route
requires `Authorization: Bearer <accessToken>` from `POST /auth/login` (see `docs/api/auth.md`) —
same admin/CMS-only scope note as `docs/api/exam-boards.md`.

All routes: `401 Unauthorized` if the bearer token is missing/invalid/expired.

## `POST /past-papers`

- **Body:** `CreatePastPaperDto` — `{ examBoardId: string, subject: string, year: number, fileUrl:
string (URL) }`
- **Behavior:** creates the row, then synchronously runs the text-extraction pipeline
  (`PastPaperIngestionService`, see `docs/adr/010-pdf-text-extraction.md`) against `fileUrl` before
  responding — the request waits for extraction to finish.
- **Response:** `201 Created`, the created `PastPaper`, with `extractionStatus` already resolved
  to `DONE` (and `extractedText` populated) or `FAILED` (`extractedText` left `null`) — never left
  at its schema default of `PENDING`. Extraction failing (unreachable `fileUrl`, non-PDF content,
  a corrupt/empty PDF, ...) does **not** fail this request; it only changes `extractionStatus` on
  the row that's still created and returned.
- **Errors:** `400 Bad Request` (validation), `404 Not Found` — `examBoardId` doesn't reference an
  existing `ExamBoard` (FK violation currently surfaces as the same gap noted in
  `docs/api/exam-boards.md`'s `DELETE` section — `P2003` isn't mapped by `PrismaExceptionFilter`
  yet, so this can surface as `500` instead; see `docs/backlog/BACKLOG.md` TAPS-2.10)

## `GET /past-papers`

- **Query:** `?examBoardId=<id>` — optional filter
- **Response:** `200 OK`, `PastPaper[]`, ordered by `createdAt` descending

## `GET /past-papers/:id`

- **Response:** `200 OK`, the `PastPaper`
- **Errors:** `404 Not Found`

## `PATCH /past-papers/:id`

- **Body:** `UpdatePastPaperDto` — any subset of `CreatePastPaperDto`'s fields
- **Behavior:** plain field update — does **not** re-run text extraction even if `fileUrl`
  changes (out of `TAPS-4.0`'s scope; tracked as a follow-up in `docs/backlog/BACKLOG.md`)
- **Response:** `200 OK`, the updated `PastPaper`
- **Errors:** `400 Bad Request` (validation), `404 Not Found`

## `DELETE /past-papers/:id`

- **Response:** `204 No Content`
- **Errors:** `404 Not Found`

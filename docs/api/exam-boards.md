# Exam Boards

Admin-only CMS CRUD for `ExamBoard` (TAPS-2.3). Every route requires `Authorization: Bearer
<accessToken>` from `POST /auth/login` (see `docs/api/auth.md`) — this is the admin/CMS surface,
not a public read API for the web app (that's a separate future EPIC 3 story, not yet in the
backlog — see `docs/backlog/BACKLOG.md`).

All routes: `401 Unauthorized` if the bearer token is missing/invalid/expired.

## `POST /exam-boards`

- **Body:** `CreateExamBoardDto` — `{ name: string, type: 'TEACHING' | 'TET', description: string }`
- **Response:** `201 Created`, the created `ExamBoard`
- **Errors:** `400 Bad Request` — validation failure (e.g. `type` not one of the enum values, an
  unknown field in the body)

## `GET /exam-boards`

- **Response:** `200 OK`, `ExamBoard[]`, ordered by `name` ascending

## `GET /exam-boards/:id`

- **Response:** `200 OK`, the `ExamBoard`
- **Errors:** `404 Not Found` — no exam board with that id

## `PATCH /exam-boards/:id`

- **Body:** `UpdateExamBoardDto` — any subset of `CreateExamBoardDto`'s fields
- **Response:** `200 OK`, the updated `ExamBoard`
- **Errors:** `400 Bad Request` (validation), `404 Not Found` (no exam board with that id)

## `DELETE /exam-boards/:id`

- **Response:** `204 No Content`
- **Errors:** `404 Not Found` — no exam board with that id; `409 Conflict` — the exam board has
  attached `Syllabus`/`PastPaper` rows (`onDelete: Restrict`, see
  `docs/adr/004-content-schema-design.md`). This is Prisma's `P2003` (foreign key constraint),
  mapped by `PrismaExceptionFilter` as of `TAPS-2.10` (previously an unmapped `500` — see
  `docs/adr/005-admin-auth-and-validation.md`). Attached `Post` rows are unaffected
  (`onDelete: SetNull`).

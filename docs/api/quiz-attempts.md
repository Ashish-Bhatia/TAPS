# Quiz attempts

End-user quiz-taking (`TAPS-5.2`): start a practice quiz for an exam board, then submit answers to
get it scored. Guarded by `UserJwtAuthGuard` (`TAPS-5.1`'s end-user session system) — never the
admin `JwtAuthGuard` — so every endpoint here requires a real `User`'s bearer token, not the admin
credential. See `docs/adr/015-quiz-attempt-data-shape.md` for why there's no separate
`Quiz`/`QuizSession` model and how `weakTopics` is computed.

## `POST /quiz-attempts/start`

- **Auth:** `Authorization: Bearer <user accessToken>` (`UserJwtAuthGuard`)
- **Body:** `{ "examBoardId": "string" }`
- **Response:** `201 Created`
  ```json
  {
    "attemptId": "string",
    "questions": [
      {
        "id": "string",
        "pastPaperId": "string",
        "subject": "string",
        "topic": "string",
        "difficulty": "EASY | MEDIUM | HARD",
        "questionText": "string",
        "options": ["string", "..."],
        "aiGenerated": true,
        "reviewedByAdmin": false,
        "aiProvider": "ANTHROPIC | OPENAI",
        "createdAt": "ISO date string"
      }
    ]
  }
  ```
  Note what's **absent**: `correctOption` and `explanation` are stripped from every question —
  they only appear once the attempt is submitted (below).
- **Selection:** up to 10 (`QUESTION_COUNT` in `quiz-attempt.service.ts`) `QuizQuestion` rows
  belonging to the given exam board, selected via `QuizQuestion`'s `PastPaper` relation
  (`QuizQuestion` has no direct `examBoardId` of its own) and ordered by `createdAt` — deterministic,
  not randomized; see the ADR for why. The selected ids are fixed on the created `QuizAttempt`
  (`in-progress`: `completedAt: null`) for the life of the attempt.
- **Errors:**
  - `404 Not Found` — no `ExamBoard` with that id
  - `400 Bad Request` — the exam board has no `QuizQuestion` rows yet (nothing to quiz on)
  - `401 Unauthorized` — missing/invalid/expired bearer token

## `POST /quiz-attempts/:id/submit`

- **Auth:** `Authorization: Bearer <user accessToken>` (`UserJwtAuthGuard`) — must be the same user
  who started the attempt
- **Body:**
  ```json
  { "answers": { "<questionId>": 0 } }
  ```
  Map of question id → selected option index (into that question's `options` array). A question
  from the attempt with no matching key is treated as unanswered (scored incorrect).
- **Response:** `200 OK`
  ```json
  {
    "score": 1,
    "totalQuestions": 3,
    "weakTopics": { "Algebra": 1, "Geometry": 1 },
    "questions": [
      {
        "id": "string",
        "questionText": "string",
        "options": ["string", "..."],
        "correctOption": 0,
        "explanation": "string",
        "selectedOption": 0,
        "isCorrect": true
      }
    ]
  }
  ```
  `correctOption`/`explanation`/`selectedOption`/`isCorrect` are only ever present in this
  post-submit response, never from `start`. `weakTopics` is a per-topic tally of incorrect answers
  (topics with zero incorrect answers are omitted, not present with a `0`).
- **Errors:**
  - `404 Not Found` — no `QuizAttempt` with that id
  - `403 Forbidden` — the attempt exists but belongs to a different user
  - `409 Conflict` — the attempt was already submitted (`completedAt` is already set); an attempt
    can only be submitted once
  - `401 Unauthorized` — missing/invalid/expired bearer token

## Verification

Unit-tested (`quiz-attempt.service.spec.ts`, `quiz-attempt.controller.spec.ts`): `start` returns
questions with no `correctOption`/`explanation`; `submit` scores a known correct/incorrect/
unanswered mix correctly and computes the matching `weakTopics` tally; a second `submit` on an
already-completed attempt is rejected (`409`); a `submit` from a user who doesn't own the attempt
is rejected (`403`). Also live-verified against the real Neon database with a running server:
temporary `PastPaper`/`QuizQuestion`/`User` rows were created, the full
`start` → `submit` (wrong user → `403`, correct user → scored `200`, second submit → `409`) flow
was exercised over real HTTP with real JWTs, plus `start` against a nonexistent `examBoardId`
(`404`) and with no bearer token (`401`) — all smoke-test rows were deleted afterward with 0
residue confirmed. See `docs/adr/015-quiz-attempt-data-shape.md`'s "Verification" section for the
full transcript summary.

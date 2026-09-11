# 015 — QuizAttempt data shape: no separate Quiz/QuizSession model

Status: Accepted

## Context

`05-ARCHITECTURE.md` §4's original stub for `QuizAttempt` was `(id, userId, quizId, score,
weakTopics[], completedAt)` — written before any of `EPIC 4`'s quiz machinery existed. By the time
`TAPS-5.2` actually builds it, the real schema looks different: `QuizQuestion` (`TAPS-4.1`) is an
individual AI-generated question tied to a `PastPaper`, and there is no `Quiz` entity anywhere in
the codebase that `quizId` could sensibly point at — a "quiz" has so far only ever meant "some
QuizQuestion rows a user is presented in one sitting," not a named, reusable, admin-authored
object. Two real decisions had to be made translating the stub into a working schema:

1. Does grouping a set of `QuizQuestion` rows into one user-facing quiz need its own
   `Quiz`/`QuizSession` model, or can `QuizAttempt` itself carry that grouping?
2. Is `weakTopics` a flat `String[]` of topic names (matching the stub literally) or a JSON tally
   of per-topic incorrect counts?

## Decision

**No `Quiz`/`QuizSession` model.** `QuizAttempt` references `ExamBoard` directly
(`examBoardId`/`examBoard`, the same `onDelete: Restrict` pattern as `Syllabus`/`PastPaper`) and
carries its own `questionIds: String[]` — the specific `QuizQuestion` ids
`QuizAttemptService.start()` selected for that attempt, fixed at creation time. There is no
intermediate row a "quiz" would occupy; the attempt _is_ the grouping. `answers: Json?` holds the
question-id → selected-option-index map the user submits, written once by `submit()`.

This was picked over introducing a `Quiz`/`QuizSession` model for a concrete reason: nothing in
this story (or in `08-AI-FEATURES-SPEC.md`'s description of `getAdaptiveQuiz`) needs a quiz to be
a persisted, addressable, reusable object independent of the act of attempting it. Two users taking
"a quiz for board X" today get two independently-selected, independently-scored question sets —
there is no shared "session" identity between them to model. A `Quiz` row would exist solely to
hold a list of `QuizQuestion` ids that `QuizAttempt.questionIds` already holds directly, adding a
join and a second lookup for zero behavioral gain. If a future story needs quizzes to be
admin-curated, named, reused across multiple users, or attempted more than once with the exact same
question set as a distinct concept from the attempt, that is a real, separately-scoped modeling
decision to make then — not one to guess at preemptively here.

**`weakTopics` is a `Json?` per-topic incorrect-count tally**, e.g. `{"Algebra": 2, "Geometry":
1}`, not a `String[]` of topic names. This is a deliberate deviation from §4's original stub, not
an oversight — the backlog acceptance criteria for this story explicitly ask for `submit` to
"compute weakTopics (per-topic incorrect tally)," which a flat name list can't represent (it can
say a topic was ever wrong, not how often, so two attempts with very different severity in the same
topic look identical). A `Json` tally keeps that information for free with no extra field, and
`05-ARCHITECTURE.md` §5's still-unbuilt `getAdaptiveQuiz` (a proposed method to select a next quiz
tuned to weak topics) is far better served by a tally it can weight by than a set it can only check
membership in.

`score` is stored as a raw `Int?` (count of correct answers), not a percentage — paired with
`questionIds.length` (equivalently `totalQuestions` in the `submit` response), the percentage is
always recoverable, while a stored percentage alone would lose the raw counts. `answers` and
`weakTopics` are both `Json?` rather than related tables: both are write-once, read-back-verbatim
blobs scoped to a single attempt with no independent query need (nothing needs to find "all
attempts where topic X was missed" yet) — a relational shape for either would be speculative
generality with no consumer.

## Consequences

- **Simpler:** one new model, no new join table, no second "what is a quiz" concept to keep in
  sync with `QuizQuestion`. `QuizAttemptService.submit()` re-fetches the exact `QuizQuestion` rows
  by `attempt.questionIds` rather than re-deriving "the quiz" through an intermediate model.
- **Trade-off accepted:** because there's no `Quiz` object, two attempts against the same
  `ExamBoard` are not provably "the same quiz" in any structural sense — they just happen to share
  an exam board and possibly overlapping questions. This is fine for TAPS-5.2's scope (practice
  quiz-taking + weak-topic tracking); a future story that needs to compare attempts against a
  canonical, reusable quiz definition will need to introduce that concept then, informed by what
  that feature actually requires.
- `QuizQuestion` has no direct `examBoardId` (it belongs to a `PastPaper`, which belongs to an
  `ExamBoard`) — `QuizAttemptService.start()` selects candidates via
  `prisma.quizQuestion.findMany({ where: { pastPaper: { examBoardId } } })`, a relation filter
  rather than a direct column filter. `QuizAttempt.examBoardId` is still a direct FK on the
  attempt itself (not derived transitively through the questions) so an attempt is still
  queryable/indexable by board even if its `questionIds` end up spanning past papers.
- **Question count:** `start()` selects `QUESTION_COUNT = 10` questions per attempt, ordered by
  `createdAt` (deterministic, not randomized). 10 is a plain default for a short practice
  quiz — no story requirement calls for a configurable or adaptive count, and randomizing
  selection is explicitly left to a future `getAdaptiveQuiz`-style story rather than built
  speculatively here. If a board has fewer than 10 `QuizQuestion` rows, `start()` simply returns
  however many exist; if it has zero, `start()` 400s rather than creating a pointless empty
  attempt.
- **Verification:** the migration (`prisma/migrations/20260911122233_add_quiz_attempt/`) was
  applied to the real Neon database via `prisma migrate deploy` and confirmed with `prisma migrate
status` ("up to date"); a live create → read → update (simulating submit) → delete round trip
  against the real `quiz_attempts` table left no residue. The full `/quiz-attempts/start` →
  `/quiz-attempts/:id/submit` flow was also exercised against a running server backed by the real
  Neon DB using temporary `PastPaper`/`QuizQuestion`/`User` rows: `start` returned questions with
  no `correctOption`/`explanation`; submitting as a different user than the attempt's owner
  returned `403`; a correct/incorrect/unanswered mix scored `1/3` with `weakTopics: {"Geometry": 1,
"Algebra": 1}` and revealed `correctOption`/`explanation` in the response; a second submit on the
  same attempt returned `409`; starting against a nonexistent `examBoardId` returned `404`; a
  request with no bearer token returned `401`. All smoke-test rows were deleted afterward
  (confirmed: 0 residue).

# Sprint 6 — EPIC 6: the mobile app's first real features

Sprint dates: 2026-09-11–09-12 (continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `929c1cb` (Sprint 5 close-out summary). Result: `develop`
at `19a599e` (`TAPS-6.5` merge, #63) as of this doc's own commit — six PRs merged, CI green on
every one. `main` has **not** been synced this sprint (per instruction) — that stays a separate,
explicit decision for Ashish.

`apps/mobile` went from the bare `create-expo-app` template (Sprint 0's scaffold, an untouched
`App.tsx` rendering static text) to a real, navigable, authenticated app: browse exam boards, log
in, take a practice quiz, and see your progress — the whole of EPIC 6 in one sprint.

## What shipped

| Story      | PR(s)                                                | Summary                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAPS-6.1` | [#58](https://github.com/Ashish-Bhatia/TAPS/pull/58) | Expo Router navigation shell (replacing the default template's `App.tsx`/`index.ts`) + exam board list/detail screens consuming `docs/api/public-content.md`'s public endpoints. `jest-expo` test tooling added — `apps/mobile`'s first test file ever, closing `TAPS-1.11`'s long-standing gap. See `docs/adr/022-mobile-navigation-and-testing.md`. |
| `TAPS-6.2` | [#59](https://github.com/Ashish-Bhatia/TAPS/pull/59) | Login screen + `expo-secure-store`-backed session (`src/lib/auth.ts`/`AuthContext.tsx`), consuming `TAPS-5.1`'s user-auth API directly (no cookie proxy needed, unlike `apps/web` — a native app has no cross-domain cookie problem to route around). See `docs/adr/023-mobile-auth-token-storage.md`.                                                |
| `TAPS-6.3` | [#60](https://github.com/Ashish-Bhatia/TAPS/pull/60) | Quiz-taking flow (`src/lib/quiz.ts`, `app/quiz/[examBoardId].tsx`) consuming `TAPS-5.2`'s start/submit endpoints, gated behind `TAPS-6.2`'s auth. Surfaced `TAPS-4.4` (below).                                                                                                                                                                        |
| `TAPS-4.4` | [#61](https://github.com/Ashish-Bhatia/TAPS/pull/61) | Doc-only correction, filed as its own backlog item — see "TAPS-4.4" below.                                                                                                                                                                                                                                                                            |
| `TAPS-6.4` | [#62](https://github.com/Ashish-Bhatia/TAPS/pull/62) | Progress dashboard (`src/lib/dashboard.ts`, `app/dashboard.tsx`) consuming `TAPS-5.3`'s `GET /quiz-attempts/me`, mirroring `apps/web`'s dashboard page's three sections and empty-state copy.                                                                                                                                                         |
| `TAPS-6.5` | [#63](https://github.com/Ashish-Bhatia/TAPS/pull/63) | Confirmed, with a real CI run's log (not an assumption), that every `TAPS-6.1`–`6.4` render test actually executes in CI — see "The three-layer evidence bar" below.                                                                                                                                                                                  |

All six landed with passing CI, tests, and docs updated in the same PR as the code (`TAPS-6.4`
needed one extra commit to resolve a `BACKLOG.md` merge conflict against `TAPS-4.4`'s doc-only PR,
re-verified green before merging), per `07-DOCUMENTATION-STANDARDS.md`.

## The three-layer evidence bar

Sprint 5's retro named "verify against the real system before merge, not after an incident forces
it" as the pattern to keep. This sprint made that concrete for mobile work specifically, after
Ashish pushed back mid-sprint that a live check of the data layer alone wasn't sufficient evidence
that a screen actually works. From `TAPS-6.2` onward, every story needed:

1. **A real API call** against the live deployed `taps-api.fly.dev` (never a mock) proving the
   underlying contract works.
2. **A real screen render** — `expo-router/testing-library`'s `renderRouter`, mounting the actual
   route files through the real route table, not a standalone component mount — proving the UI
   itself (not just the data-fetching layer) correctly reflects that state.
3. **A real bundle compile** (`npx expo export --platform android`) confirming the app actually
   builds for the target platform.

Genuinely different attempts were also made, per direct instruction, to get real on-device
verification (`npx expo start --android` via Expo Go) rather than assuming it unavailable: `which
adb emulator` found neither installed, `--android` fails on a missing GUI shared library
(`libatk-1.0.so.0`), and even the bare dev server hit a separate `@expo/cli`/`expo-router` version-
mismatch bug — three independent, confirmed failure points, not an assumption. On-device
verification is genuinely unavailable in this sandbox; every story says so plainly rather than
rounding a lesser check up to "tested."

## `TAPS-6.1`'s regression: caught by the same evidence bar, not by an incident

Extending `TAPS-6.1`'s render tests to hit the real API (attempted for `TAPS-6.2`) surfaced that
`TAPS-6.1`'s own render tests — colocated inside `app/`, matching this repo's usual convention —
had been **silently breaking `npx expo export` on `develop` since their own commit**. Expo Router's
own docs are explicit that test files must never live inside `app/` (every file there is route-
discoverable); `expo-router/testing-library`'s Node-only `import "path"` was getting pulled into the
app's route graph, and nobody had re-run `expo export` after adding those tests to notice.

Fixed in `TAPS-6.2`: all four render-test files (`TAPS-6.1`'s two, plus the two new ones) moved to
`apps/mobile/__tests__/`, re-verified passing and building. `TAPS-6.1`'s own backlog row was
corrected in place afterward rather than left standing on a claim that had gone stale one commit
later — see `docs/adr/023-mobile-auth-token-storage.md`'s write-up. Every route-rendering test added
since (`TAPS-6.3`, `TAPS-6.4`) went straight into `__tests__/` from the start.

## `TAPS-4.4`: discovery and correction

`TAPS-6.3`'s live verification first found `POST /quiz-attempts/start` `400`ing for every real exam
board — `prisma.quizQuestion.groupBy` showed zero distinct past papers with questions anywhere in
production. Filed as `TAPS-4.4` at the time, scoped as "seed a `QuizQuestion` bank."

A direct question from Ashish before `TAPS-6.4` began ("is this a one-command ops fix or a real
story?") prompted a deeper check that found the gap was bigger than first filed: **`PastPaper`,
`Post`, `Syllabus`, and `StudyMaterial` are all `0` rows in production, not just `QuizQuestion`** —
only `ExamBoard`'s 9-row seed has ever existed. `TAPS-4.1`/`TAPS-4.2`'s generation pipeline itself
needs no code change — `POST /past-papers/:id/generate-quiz` already works once a `PastPaper`
reaches `extractionStatus: DONE` — but there's no `PastPaper` row anywhere to run it against, in
this or any prior story; every row any past epic's own live smoke test ever created was cleaned up
afterward (this project's own convention), so nothing accumulated.

`TAPS-4.4`'s backlog row was corrected (PR #61) to say so plainly: this is a real content-sourcing
task needing Ashish directly (a genuine past-exam-paper PDF + the admin password), not a code story
and not sized for sprint planning. It stays `Ready`, not attempted here.

## Blocked ops actions — a real, working guardrail, not a gap

Three times this sprint, the sandbox's permission classifier blocked a direct production-database
write attempted for live-verification purposes: deleting `TAPS-6.2`'s temporary smoke-test user,
deleting `TAPS-6.3`'s, and creating a temporary `PastPaper` fixture to work around `TAPS-4.4` (the
same pattern `TAPS-5.2` used successfully in Sprint 5 — this sprint's sandbox draws that line
differently, and correctly, for a session with no standing authorization to mutate production
data). None of these were worked around; each was reported plainly with the exact `prisma db
execute --stdin` command for Ashish to run himself, scoped by unique email/id where deletion was
needed.

**A gap in that reporting, caught only while writing this summary, stated here rather than
smoothed over:** `TAPS-6.4`'s live verification also registered a real temporary user
(`taps-6.4-live-check-1@example.com`) against production — its GET-only check needed no fixture
cleanup, so no delete command was ever handed over for the row registration itself created. A fresh
check just now (writing this summary) found it, plus the still-undeleted pair from `TAPS-6.2`/
`6.3`'s own cleanup handoff, still present: **3 leftover rows in production's `users` table**,
none used for anything beyond auth checks (no `QuizAttempt`s, no other data):

```sql
-- Confirm before touching anything
SELECT id, email, "createdAt" FROM users WHERE email IN (
  'smoke-test+1789150054-21984@taps-smoke-test.invalid',
  'smoke-test+1789159259-19653@taps-smoke-test.invalid',
  'taps-6.4-live-check-1@example.com'
);

-- Delete all three
DELETE FROM users WHERE email IN (
  'smoke-test+1789150054-21984@taps-smoke-test.invalid',
  'smoke-test+1789159259-19653@taps-smoke-test.invalid',
  'taps-6.4-live-check-1@example.com'
);
```

Run from `apps/api` via `... | npx prisma db execute --stdin --schema=prisma/schema.prisma`, same
as every other delete command this sprint.

## What moved

`TAPS-1.11` — **Partially Done → Done** (closed as a side effect of `TAPS-6.1`'s `jest-expo`
addition — `apps/mobile` was the one workspace still missing test tooling). `TAPS-6.1`, `TAPS-6.2`,
`TAPS-6.3`, `TAPS-6.4`, `TAPS-6.5` — all **Ready → Done**. `TAPS-4.4` — newly filed **Ready** (not
attempted; needs Ashish's direct action). No story was left mid-sprint or silently dropped.
**EPIC 6 is now fully done.**

## Verification

CI was green on all six PRs. Full test suites were re-run fresh for this summary rather than
assumed from prior PR descriptions, against `develop`'s actual current HEAD (`19a599e`):

- `apps/api`: `npm run test --workspace=api` — **36 test files, 152/152 passing**, no regressions.
- `apps/mobile`: `npm run test --workspace=mobile` — **10 test files, 49/49 passing**, no
  regressions.
- `apps/web`: `npm run test --workspace=web` — **22 test files, 91/91 passing**, no regressions.
- `npx expo export --platform android` (`apps/mobile`): real success, 1250 modules — confirmed
  fresh against `develop`'s HEAD, not just assumed from `TAPS-6.4`'s own PR run.

All counts match what each story's own PR reported at merge time — nothing has drifted since.

## Retro

**What worked:** the three-layer evidence bar (real API call, real screen render, real bundle
compile) — introduced mid-sprint on direct pushback, not something this session arrived with —
caught a real, already-merged regression (`TAPS-6.1`'s test-location bug) and a real logic bug
(`TAPS-6.3`'s quiz screen would have spun forever for a logged-out visitor) before either reached a
user. Both were found by tests written to meet the bar, not by a later incident. That's Sprint 5's
retro pattern ("verify before merge, not after an incident") holding for a second sprint running,
now on a codebase (mobile) that had zero test coverage at the start of this one.

**What needs to actually change, not just be disclosed better:** three separate live-verification
steps this sprint each created a production row without a cleanup path built in up front — the
delete command was worked out reactively each time, and one (`TAPS-6.4`'s) was missed entirely until
this summary's own fresh-check pass caught it. The pattern that would have prevented all three:
decide the cleanup command _before_ running the live-verification step that needs a real user, not
after. Worth carrying into Sprint 7 as a standing habit for any story whose live evidence requires
creating a real row this session can't delete itself.

**A real, working guardrail, not a process gap:** the permission classifier blocking direct
production-database writes (three times this sprint) is exactly what caught `TAPS-4.4`'s fixture-
creation workaround before it happened — a session with no standing authorization to mutate
production data shouldn't be able to talk itself into it just because a prior sprint's pattern
(`TAPS-5.2`'s fixtures) would have made it convenient. Every block was reported plainly with the
exact command for Ashish to run instead, not routed around.

## Sprint 7

Not yet planned. EPIC 6 is closed. Real candidates carried forward, none yet approved:

- `TAPS-4.4` — content-sourcing/ops action for Ashish (a real past-exam-paper PDF + admin login);
  not a code story, doesn't need sprint planning so much as a decision on when to do it.
- Sprint 5's own carryover, still untouched: `TAPS-1.12`/`1.13` (`packages/types`/`packages/ui` as
  real shared workspaces — would let `apps/mobile` and `apps/web` stop duplicating public-API
  types/fetch wrappers, a gap both apps now share independently), `TAPS-2.5` (Prisma 7.x/8.x
  upgrade), `TAPS-2.8` (the `deepmerge-ts` advisory), `TAPS-2.12` (`multer` DoS advisories).
- EPIC 7 (AI study-plan generator) and EPIC 8 (AI doubt-solving assistant) have no stories yet.

Whether/when to sync `develop` to `main` is, again, a separate, explicit decision for Ashish — not
bundled into sprint planning or this close-out by default.

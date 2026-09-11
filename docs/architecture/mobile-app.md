# `apps/mobile` — App Structure & Navigation

Covers `TAPS-6.1`/`TAPS-6.2`/`TAPS-6.3`/`TAPS-6.4`. Expo SDK 57, Expo Router (`app/` directory). See
`docs/adr/022-mobile-navigation-and-testing.md` for why Expo Router (not bare React Navigation) and
`jest-expo` (not Vitest, despite `apps/web`/`apps/api`'s use of it) were chosen,
`docs/adr/023-mobile-auth-token-storage.md` for the `expo-secure-store` decision, and
`docs/adr/018-mobile-export-platform-scope.md` for why this app has no web target.

## Layout & navigation

`package.json`'s `main` is `expo-router/entry` (not the old `create-expo-app` template's
`index.ts`/`App.tsx`, both deleted) — Expo Router owns the entry point and derives routes from the
`app/` directory's file structure:

- `app/_layout.tsx` — root layout: a plain `expo-router` `Stack` (no tabs/drawer yet — those, plus
  `TAPS-6.2`'s login screen and whatever navigation shape the authenticated area needs, are out of
  this story's scope).
- `app/index.tsx` — the initial route: exam board list (`GET /public/exam-boards`).
- `app/exam-boards/[id].tsx` — exam board detail: the board's own info plus its published posts
  (`GET /public/exam-boards/:id` + `GET /public/posts?examBoardId=:id`). Sub-sections analogous to
  `apps/web`'s Syllabus/Exam Pattern/Previous Papers/Study Material/Eligibility pages (`TAPS-3.6`)
  are a separate future story, not built here.
- `app.json`'s `experiments.typedRoutes: true` — Expo Router generates typed `href`s for the routes
  above, so `Link`/`useLocalSearchParams` calls are checked against the real route table by `tsc`.
- `app/account.tsx`, `app/login.tsx` (`TAPS-6.2`) — the authenticated area's entry point. A header
  `Account` link (`app/_layout.tsx`'s shared `screenOptions.headerRight`) is visible on every
  screen; `/account` shows the logged-in email + a logout button, or a link to `/login` when
  logged out.

## Authentication (`TAPS-6.2`)

`src/lib/auth.ts` calls `POST /user-auth/login` (`docs/api/user-auth.md`) directly from the device —
no server-to-server proxy like `apps/web`'s Route Handlers, since there's no cross-domain cookie
problem for a native app to route around. On success it persists `{ accessToken, email }` via
`expo-secure-store` (OS-level encrypted storage — see ADR 023 for why, over the more commonly
reached-for `AsyncStorage`, which persists as plaintext). `src/lib/AuthContext.tsx`'s `AuthProvider`
wraps the whole app (`app/_layout.tsx`) and restores this on mount, exposing
`status`/`email`/`token`/`login`/`logout` to every screen via `useAuth()` — `TAPS-6.3`/`6.4`'s
screens gate on this rather than each re-reading `expo-secure-store` independently, and reuse
`src/lib/auth.ts`'s `apiFetchAuthed` (mirroring `apps/web/src/lib/api.ts`'s helper of the same name)
for their own authenticated fetches.

## Quiz-taking (`TAPS-6.3`)

`src/lib/quiz.ts` — `startQuiz(examBoardId, token)` (`POST /quiz-attempts/start`) and
`submitQuiz(attemptId, answers, token)` (`POST /quiz-attempts/:id/submit`, `docs/api/quiz-
attempts.md`). No `apps/web` equivalent to mirror — `apps/web` never built a quiz-taking UI, only
`TAPS-5.1`'s auth API and `TAPS-5.3`'s read-only dashboard consume this data on that side — so this
module's shape is new. There is no `GET /quiz-attempts/:id` to re-fetch an in-progress attempt, so
`app/quiz/[examBoardId].tsx` holds the questions `start` returns in its own local state (a `Phase`
discriminated union: `starting → answering → submitting → submitted`, or `error` from any step) for
the life of the attempt, rather than treating them as re-fetchable data — a direct consequence of
the API's own shape (`docs/adr/015-quiz-attempt-data-shape.md`), not a choice made here.

Entry point: a "Practice quiz" button in `app/exam-boards/[id].tsx`'s header, gated on
`useAuth().status` exactly like `TAPS-6.3` gates the quiz screen itself — logged in links to
`/quiz/[examBoardId]`, logged out links to `/login` instead. **Order matters in the quiz screen's
own render logic**: `status === 'unauthenticated'` is checked _before_ `phase.kind === 'starting'`,
because the quiz-starting effect deliberately returns early without ever changing `phase` when
logged out (there's nothing to start) — checking the loading spinner first would leave a logged-out
visitor stuck on a spinner forever. A real render test (`__tests__/quiz.test.tsx`) caught this
ordering bug before merge, not in production.

## Progress dashboard (`TAPS-6.4`)

`src/lib/dashboard.ts` — `getMyQuizAttempts(token)` reuses `src/lib/auth.ts`'s `apiFetchAuthed`
directly (a plain authed `GET`, unlike `TAPS-6.3`'s `quiz.ts`, which needed authed `POST`s
`apiFetchAuthed` doesn't cover) against `GET /quiz-attempts/me` (`docs/api/quiz-attempts.md`,
`TAPS-5.3`). `app/dashboard.tsx` mirrors `apps/web/src/app/dashboard/page.tsx`'s three sections
(accuracy trend, weak-topic heatmap, attempt history) and its empty-state copy verbatim. React
Native has no built-in charting library — the accuracy trend is a plain `View`-bar row (height set
via a percentage style, same idea as the web version's `div` bars) rather than a canvas/SVG chart;
same information, no new dependency added for it.

Entry point: a "Your progress" link on `app/account.tsx`, next to the logout button — the quiz-
taking flow (`TAPS-6.3`) is reached from an exam board's own detail screen instead, so this screen
now has two distinct authenticated-area entry points rather than one.

A `401` from `getMyQuizAttempts` (the bearer token itself rejected — stale or tampered, as opposed
to `status === 'unauthenticated'`, "never logged in") calls `useAuth().logout()` and redirects to
`/login`, mirroring `apps/web`'s `UnauthorizedApiError`/`clearSessionAndRedirectToLogin` distinction
exactly — same reason: a visitor whose session already lapsed shouldn't get stuck bouncing between
`/dashboard` and a still-"logged-in"-looking `/account`.

## Data fetching

`src/lib/api.ts` — `apiUrl()` reads `EXPO_PUBLIC_API_URL` (Expo's client-env prefix, mirroring
`apps/web/src/lib/api.ts`'s `NEXT_PUBLIC_API_URL`), falling back to `http://10.0.2.2:8080` — the
Android emulator's loopback alias for the host machine, not `localhost` (see ADR 022). `getExamBoards`
does **not** fail soft to an empty list (unlike `apps/web`'s `getExamBoardsForNav`, which backs a
nav rendered on every page): this screen's entire purpose is the list itself, so a real API error
surfaces as a retryable error state instead. `getExamBoard` returns `null` specifically for a `404`
("no such exam board"), same convention as `apps/web`'s version, which the detail screen renders as
a not-found state rather than throwing.

There is no `cache`/`next.tags` layer here (unlike `apps/web`'s `TAPS-3.7` tagged caching) — React
Native's `fetch` has no equivalent concept, and every screen fetches fresh on mount/param change.

## Effect/fetch pattern

Every screen's data-fetching `useEffect` keeps its `setState` calls inside the fetch promise's
`.then`/`.catch`/`.finally` rather than calling a shared function that synchronously resets
loading/error state first — `eslint-config-expo`'s flat config includes `react-hooks`'s
`set-state-in-effect` rule, which rejects the latter as an unsafe direct/synchronous `setState`
inside an effect. A `cancelled` flag guards against a stale response resolving after unmount or a
re-fetch (`id` changing, or a retry). See `app/index.tsx`/`app/exam-boards/[id].tsx`'s inline
comments for the exact reasoning, and ADR 022's "Consequences" section.

## Testing

`jest-expo` (`package.json`'s `"test": "jest"`, `"jest": { "preset": "jest-expo" }`) — picked up
automatically by `.github/workflows/ci.yml`'s existing `npm run test --workspace=mobile --if-present`
step, no CI workflow change needed. `src/lib/api.test.ts` covers `apiUrl`'s env-var fallback and
`getExamBoards`/`getExamBoard`/`getPostsByExamBoard`'s success/404/error-response paths against a
mocked `fetch`, same style as `apps/web/src/lib/api.test.ts`. This closes `TAPS-1.11`'s
long-standing gap ("`apps/mobile` has no test script and no test tooling at all") for this
workspace.

`src/lib/quiz.test.ts` (`TAPS-6.3`) covers `startQuiz`/`submitQuiz`'s request shape and
401/other-non-OK handling the same way, as does `src/lib/dashboard.test.ts` (`TAPS-6.4`) for
`getMyQuizAttempts` (including the real "empty history" `200` shape, not just error paths).

`__tests__/index.test.tsx`, `__tests__/exam-boards/[id].test.tsx`, `__tests__/login.test.tsx`,
`__tests__/account.test.tsx`, `__tests__/quiz.test.tsx`, `__tests__/dashboard.test.tsx` go one level
further: `expo-router/testing-library`'s `renderRouter`
mounts the actual route files through the real route table (real navigation, real
`useLocalSearchParams`), asserting on real rendered text from a mocked `fetch`/`expo-secure-store` —
proof the screens themselves, not just `api.ts`/`auth.ts`, correctly turn a response into visible
content. See ADR 022 for why this stays mocked rather than hitting the real API inside Jest (RN's
Jest preset mocks networking at the native-module layer; independent attempts to route around that
all failed) and where the corresponding live verification actually happened instead.

**These live in `apps/mobile/__tests__/`, not colocated inside `app/`** — despite every other test
in this repo being colocated `*.test.ts(x)` next to what it tests (`06-CODING-STANDARDS.md`). Expo
Router's own docs are explicit that test files must never live inside `app/` (every file there is
route-discoverable), and `TAPS-6.2` found out why the hard way: `TAPS-6.1`'s colocated render tests
had silently broken `npx expo export` on `develop` since their own commit, because
`expo-router/testing-library`'s Node-only `import "path"` got pulled into the app's route graph.
See ADR 023's writeup. `renderRouter`'s first argument (`'./app'` in every file) resolves from the
Jest process's root directory (`apps/mobile`), not from the test file's own location — confirmed by
testing it, not assumed — so it's identical across every file in `__tests__/` regardless of nesting.
`src/lib/*.test.ts` (`api.test.ts`, `auth.test.ts`, `quiz.test.ts`, `dashboard.test.ts` — no route
files involved) stay
colocated as before; only route-rendering tests need to live outside `app/`.

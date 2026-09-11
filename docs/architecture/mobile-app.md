# `apps/mobile` — App Structure & Navigation

Covers `TAPS-6.1`. Expo SDK 57, Expo Router (`app/` directory). See
`docs/adr/022-mobile-navigation-and-testing.md` for why Expo Router (not bare React Navigation) and
`jest-expo` (not Vitest, despite `apps/web`/`apps/api`'s use of it) were chosen, and
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

# 022 — `apps/mobile`: Expo Router for navigation, `jest-expo` for tests

Status: Accepted

## Context

`TAPS-1.3` (Sprint 0) scaffolded `apps/mobile` with the bare `create-expo-app` default template —
a single `App.tsx` rendering static text, registered via `index.ts`'s `registerRootComponent`, no
navigation and no test tooling. `TAPS-6.1` is the first story to add real screens (an exam board
list + detail, consuming `docs/api/public-content.md`'s public endpoints), which needs an actual
navigation solution, and `TAPS-1.11` had already flagged `apps/mobile` as the one workspace with no
`test` script at all.

Two real choices needed making before writing any screen code:

1. **Navigation:** Expo's own current install docs (`https://docs.expo.dev/router/installation/`,
   fetched against the exact installed SDK — `apps/mobile/AGENTS.md`'s standing instruction, not
   assumed from training data) present Expo Router as the default path for a new Expo app: file-
   based routing (`app/` directory) built on top of React Navigation, installed via `npx expo
install expo-router react-native-safe-area-context react-native-screens expo-linking
expo-constants` and wiring `package.json`'s `main` to `expo-router/entry`. The alternative — wiring
   up bare `@react-navigation/native` + a stack navigator by hand — is the same underlying library
   with strictly more boilerplate (manual `NavigationContainer`/screen registration, no file-based
   routes, no typed-routes support) for no offsetting benefit at this project's scale.
2. **Testing:** `06-CODING-STANDARDS.md` §"Testing" specifies Jest, colocated as `*.test.ts` —
   `apps/web`/`apps/api` both ended up on Vitest instead (a prior, undocumented-as-ADR deviation),
   but nothing about that choice carries over cleanly to React Native: Vitest's transform pipeline
   isn't built for RN's Flow-typed native modules, while `jest-expo` is Expo's own maintained Jest
   preset, built and versioned specifically for this exact problem (`npx expo install jest-expo
jest @types/jest --dev` resolves an SDK-57-compatible set automatically, same as any other Expo-
   managed dependency).

## Decision

- **Expo Router**, not bare React Navigation. `app.json` gets a `scheme` (`taps`, needed for deep
  linking) and `"experiments": { "typedRoutes": true }`; `App.tsx`/`index.ts` are deleted (dead code
  once `main` points at `expo-router/entry` instead) in favor of `app/_layout.tsx` (root `Stack`)
  and per-route files (`app/index.tsx`, `app/exam-boards/[id].tsx`).
- **`jest-expo`**, not Vitest, for `apps/mobile`'s unit tests — this is a deliberate, documented
  divergence from `apps/web`/`apps/api`'s actual (undocumented) tooling, but it's the one that
  actually matches `06-CODING-STANDARDS.md`'s original Jest bar, and it's what closes `TAPS-1.11`'s
  gap for this workspace (see that row's update in `docs/backlog/BACKLOG.md`). `package.json`'s
  `test` script (`jest`) is picked up automatically by `.github/workflows/ci.yml`'s existing `npm
run test --workspace=mobile --if-present` — no CI workflow change needed.
- **`EXPO_PUBLIC_API_URL`**, mirroring `apps/web`'s `NEXT_PUBLIC_API_URL` convention
  (`apps/web/src/lib/api.ts`) — Expo's own client-env prefix, inlined into the bundle at build time,
  not a secret. Falls back to `http://10.0.2.2:8080` (the Android emulator's loopback alias for the
  host machine, **not** `localhost` — inside the emulator's own network namespace `localhost`
  resolves to the emulator itself, not the host running `apps/api`'s dev server) rather than web's
  `http://localhost:8080` fallback, since the two apps run in genuinely different network contexts.

## Consequences

- `apps/mobile/src/lib/api.ts`/`types.ts` duplicate `apps/web`'s equivalent shapes/fetch pattern
  rather than sharing code — same reasoning as `apps/web/src/lib/types.ts`'s own comment
  (`packages/types` is still an empty placeholder, `TAPS-1.12`), now true on both clients.
  `apps/mobile`'s `apiFetch` has no `cache`/`next` options at all (those are Next.js-specific fetch
  extensions apps/web's version uses for `TAPS-3.7`'s tag-based revalidation) — React Native's
  `fetch` has no equivalent concept, so there's nothing to port.
- `react-hooks`'s current `set-state-in-effect` lint rule (part of `eslint-config-expo`'s flat
  config) rejects the straightforward "call an async `load()` that synchronously resets
  loading/error state, then fetches" pattern used elsewhere in this codebase's React code — every
  `useEffect`-driven fetch in `apps/mobile` instead keeps its `setState` calls entirely inside
  `.then`/`.catch`/`.finally` (an async continuation, not synchronous effect-body execution), with
  a `cancelled` flag guarding against a stale response landing after unmount/re-fetch, and any
  user-triggered reset (e.g. a retry button) done in the event handler instead of a shared function
  the effect also calls. See `app/index.tsx`/`app/exam-boards/[id].tsx`'s inline comments.
- **Numbering note:** this is ADR **022**, not **021** — `021` was already taken by
  `021-db-aware-readiness-check.md` (`TAPS-2.7`, Sprint 5) by the time this story started. The
  original sprint-planning instruction named `021-mobile-auth-token-storage.md` for `TAPS-6.2`;
  that story's ADR will need to be filed as `023` instead once reached, to avoid colliding with
  this one.

**Revisit when:** `packages/types` (`TAPS-1.12`) becomes a real shared workspace — at that point
`apps/mobile`'s and `apps/web`'s duplicated public-API types/fetch wrapper are exactly the kind of
code that migration should consolidate.

# Local Development Setup

## Prerequisites

- Node.js 24.x and npm 11.x (matches CI — see `.github/workflows/ci.yml`)
- Git

## First-time setup

```bash
git clone <repo-url>
cd TAPS
npm install     # installs apps/web, apps/api, apps/mobile, packages/* from the root
```

This is an npm workspaces monorepo — always run `npm install` from the repo root, never inside
an individual `apps/*` directory. One root `package-lock.json` covers everything (see
`docs/adr/001-monorepo-tooling.md` for why).

`npm install` also runs `husky` via the root `prepare` script, wiring up the pre-commit hook
(Prettier + ESLint — see below) automatically. No extra step needed.

## Running each app

| App           | Command                             | Notes                                                                                             |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| Web (Next.js) | `npm run dev --workspace=web`       | http://localhost:3000                                                                             |
| API (NestJS)  | `npm run start:dev --workspace=api` | http://localhost:3000 by default — set `PORT` to avoid clashing with web                          |
| Mobile (Expo) | `npm run start --workspace=mobile`  | opens the Expo dev tools; `npm run android` / `npm run ios` / `npm run web` for a specific target |

## Linting, formatting, testing

```bash
npm run lint --workspaces --if-present    # ESLint in every app (web, api, mobile)
npm run format                            # Prettier --write, repo-wide
npm run format:check                      # Prettier --check, repo-wide (what CI runs)
npm run test --workspaces --if-present    # currently only apps/api has tests (Vitest)
```

Each app's `lint` script uses its own framework-specific ESLint flat config (Next's for `web`,
Expo's for `mobile`, plain `typescript-eslint` for `api`) — there is no single root ESLint
config, by design (see the ADR above).

## Pre-commit hook

`.husky/pre-commit` runs on every `git commit`:

1. `lint-staged` — Prettier on staged files (`.lintstagedrc.json`)
2. `npm run lint --workspaces --if-present` — full ESLint pass

A failing commit means one of these two failed; fix and re-commit. There is currently no
Definition-of-Done bypass for this — see `06-CODING-STANDARDS.md`.

## Environment variables

No `.env` is required yet at Sprint 0 (no database, no external API keys wired up). When one is
added, it will ship with a committed `.env.example` in the same PR, per
`06-CODING-STANDARDS.md` §Environment & Secrets.

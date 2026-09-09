# 001 — Monorepo Tooling: npm Workspaces, Shared ESLint/Prettier, Husky

Status: Accepted

## Context

Sprint 0 needed a single, repeatable way to install dependencies, lint, and test across
`apps/web` (Next.js), `apps/api` (NestJS), and `apps/mobile` (Expo/React Native), matching the
monorepo layout in `05-ARCHITECTURE.md`. Three issues had to be resolved:

1. **Install/lockfile strategy.** Each app had been scaffolded independently (its own
   `package-lock.json` and `node_modules`), which drifts over time and doesn't match the
   documented monorepo layout, and gives Husky nothing repo-wide to hook into (git hooks are
   repo-wide, not per-package).
2. **Lint tooling divergence.** `apps/api` had been scaffolded with `oxlint`, while
   `06-CODING-STANDARDS.md` mandates ESLint + Prettier everywhere. `apps/web` (Next.js) and
   `apps/mobile` (Expo) each need their own framework-specific ESLint flat config — that part
   can't be unified into one root config.
3. **React version mismatch across apps.** `create-next-app` pinned `react@19.2.8` for `web`;
   Expo SDK 57's template pins `react@19.2.3` (a peer of `react-native@0.86.3`) for `mobile`.
   Both are exact pins, and Next's own peer range (`^19.0.0`) is satisfied by either. With two
   different exact versions requested across workspaces, npm's installer nests React (and
   anything whose resolution depends on sitting next to it, notably `next` itself) inside
   `apps/web/node_modules` rather than hoisting it to the root — but `eslint-config-next` (no
   such conflict) hoists to the root, and Node's module resolution won't walk back down into a
   sibling workspace to find `next`. The result: `eslint-config-next` cannot resolve
   `next/dist/compiled/babel/eslint-parser` and linting `web` fails outright.

## Decision

- **npm workspaces** (`apps/*`, `packages/*`) with a single root `package.json` and a single
  root `package-lock.json`. Per-app lockfiles and `node_modules` were removed.
- **ESLint everywhere, one per app.** `apps/api`'s `oxlint` was replaced with ESLint
  (`typescript-eslint` flat config), carrying over its two rule overrides
  (`no-explicit-any: off`, `no-floating-promises: warn`) so behavior didn't regress.
  `apps/web` keeps `eslint-config-next`'s flat config; `apps/mobile` uses `eslint-config-expo`
  (added via `npx expo lint`). Each app's `npm run lint` stays framework-native; the root
  `npm run lint` fans out to all of them via `--workspaces --if-present`.
- **Prettier is repo-wide**, defined once at the root (`.prettierrc.json`, `.prettierignore`);
  the per-app `.prettierrc` in `apps/api` was removed so there's one formatting config, not one
  that drifts per app.
- **`apps/web`'s React pin was lowered from `19.2.8` to `19.2.3`** to match `apps/mobile` and
  `apps/api`'s (transitive) expectations. This keeps exactly one React version in the repo,
  which lets npm hoist `react`, `react-dom`, `next`, and `eslint-config-next` to the same root
  `node_modules` directory — resolving the lint failure without fighting npm's hoister. 19.2.3
  and 19.2.8 are both patch releases on the same minor line and both satisfy Next's own peer
  range, so this is a low-risk downgrade.
- **Husky + lint-staged** at the root: a `pre-commit` hook runs `lint-staged` (Prettier on
  staged files) followed by `npm run lint --workspaces --if-present` (full ESLint run — small
  enough at Sprint 0 scale to run in full rather than building staged-file-to-workspace path
  mapping).

## Consequences

- **Easier:** one `npm install` at the repo root sets up all three apps; one Husky hook and one
  Prettier config apply everywhere; CI can run `npm ci && npm run lint --workspaces && npm run
test --workspaces` without per-app special-casing.
- **Harder:** `apps/web` and `apps/mobile` (or `apps/api`) will conflict again if a future
  dependency bump reintroduces a version split — that's an inherent property of npm's hoisting
  in a mixed Next.js/Expo monorepo, not something this decision eliminates permanently. If it
  recurs, re-check `npm explain <package>` for the conflicting peer before reaching for a
  version bump.
- Bumping `apps/web`'s React version independently of `create-next-app`'s default means a
  future `npx create-next-app` diff/upgrade will need this pin re-applied deliberately, not
  copy-pasted.

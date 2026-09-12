# TAPS

TAPS (Teacher Assessment and Preparation System) is a web + mobile platform for aspirants
preparing for Indian government teaching posts (DSSSB/KVS/NVS/BPSE/UP-TGT-PGT/REET and
CTET/UPTET/HTET-style exams): recruitment notifications, syllabus/past-paper/study-material
content, and — its core differentiator — AI-driven adaptive practice tests, study plans, and a
doubt-solving assistant. Full product vision: `docs/project-knowledge/02-PRODUCT-VISION-AND-PRD.md`.

## Architecture

An npm workspaces monorepo: `apps/web` (Next.js) and `apps/mobile` (Expo/React Native) both talk
to one shared `apps/api` (NestJS) backend, with types shared via `packages/types`. AI features
(quiz generation, adaptive selection, study plans, doubt-solving) all route through a single
`AIService` boundary in the API so the model/provider can change without touching controllers or
frontend code. Full detail: `docs/project-knowledge/05-ARCHITECTURE.md`.

## Running locally

```bash
npm install                              # once, from the repo root
npm run dev --workspace=web              # Next.js — http://localhost:3000
npm run start:dev --workspace=api        # NestJS
npm run start --workspace=mobile         # Expo dev tools
npm run lint --workspaces --if-present   # ESLint, every app
npm run test --workspaces --if-present   # Vitest (apps/web, apps/api), jest-expo (apps/mobile)
```

Full setup instructions (prerequisites, pre-commit hook, environment variables):
`docs/setup/local-development.md`.

## Deployment

`apps/api` ships as a Docker image (`apps/api/Dockerfile`) to Fly.io (`apps/api/fly.toml`) and is
live; deploy steps: `docs/runbooks/deploy-api.md`. `apps/web` is live on Vercel Production.

## Current sprint

**Sprint 7** — closed. `TAPS-4.5` (quiz-generation chunking, `docs/adr/025-quiz-generation-paper-chunking.md`)
and `TAPS-4.6` (Chanakya-font Devanagari mojibake, `docs/adr/024-chanakya-devanagari-mojibake-conversion.md`)
both done, and `TAPS-4.7` proved both live end-to-end against real production services (real R2,
real Neon DB, real OpenAI) — 225 real `QuizQuestion` rows now exist for the CTET exam board, which
also finally closes `TAPS-4.4` (on the second attempt — the first production row was itself
corrupted evidence of the two bugs just fixed, see `docs/sprints/sprint-07-summary.md`). `TAPS-2.13`
(Sprint 6 spillover) and Sprint 6's own mobile work (`TAPS-6.1`–`6.5`) were carried into this
sprint's sync of `develop` to `main` (PR #71), triggering a real production deploy via `TAPS-1.22`.
Also closed: `TAPS-1.30` (branch cleanup, 17 branches down to 3) and `TAPS-1.29` (branch protection/
Dependabot/security overview re-verified directly via the GitHub UI, after the API repeatedly
403'd Claude Code's token). New from that re-verification, not yet started: `TAPS-1.32` (3
High-severity `multer` DoS advisories) and `TAPS-1.33` (CodeQL setup). `TAPS-1.31` (Anthropic vendor
decision) is deferred to the founder. Since then, `TAPS-2.14`'s investigation found `Syllabus` had
no admin CRUD and no `SyllabusTopic` model (topics are a flat `String[]` on `Syllabus` itself,
matching the architecture doc), which scoped `TAPS-2.15`: real, official-source syllabus content
(never `sarkariteachers.com`) now seeded for 4 of the 9 real exam boards — CTET, HTET, REET, DSSSB
— with the other 5 deliberately left unseeded rather than fabricated (each board's specific
blocker — a hijacked domain, a JS-only SPA, no indexed syllabus PDF — is documented in that story's
backlog row and in `docs/runbooks/database-seeding.md`). `TAPS-3.9` wired the `/syllabus` category
page to real data the same way `TAPS-3.6` already wired the per-board pages; `/previous-papers` and
`/study-materials` have the identical stale-placeholder bug, filed as `TAPS-3.10`. Sprint 8 not yet
formally planned. Sprints 1–7 summaries: `docs/sprints/`. Backlog: `docs/backlog/BACKLOG.md`.

## Contributing

Branching, commit format, PR checklist, and coding standards: `docs/project-knowledge/06-CODING-STANDARDS.md`.
Documentation requirements (what must be written, and when): `docs/project-knowledge/07-DOCUMENTATION-STANDARDS.md`.

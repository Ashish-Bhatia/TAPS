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

**Sprint 7** — in progress. `TAPS-2.13` (Cloudflare R2 object storage + the `apps/api` upload path
it unblocks) shipped ahead of formal sprint planning — a real bucket, a real `POST /storage/upload`,
and a real uploaded/fetched-back file confirming `PastPaper.fileUrl` now has an actual producer.
`TAPS-4.5` (quiz-generation chunking, `docs/adr/025-quiz-generation-paper-chunking.md`) and
`TAPS-4.6` (Chanakya-font Devanagari mojibake, `docs/adr/024-chanakya-devanagari-mojibake-conversion.md`)
are both done, and `TAPS-4.7` proved both live end-to-end against real production services (real
R2, real Neon DB, real OpenAI) — 225 real `QuizQuestion` rows now exist for the CTET exam board,
which also finally closes `TAPS-4.4`. Sprints 1–6 summaries: `docs/sprints/`. Backlog:
`docs/backlog/BACKLOG.md`.

## Contributing

Branching, commit format, PR checklist, and coding standards: `docs/project-knowledge/06-CODING-STANDARDS.md`.
Documentation requirements (what must be written, and when): `docs/project-knowledge/07-DOCUMENTATION-STANDARDS.md`.

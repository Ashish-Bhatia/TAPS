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
npm run test --workspaces --if-present   # Vitest (apps/api); more apps get test scripts as they gain code
```

Full setup instructions (prerequisites, pre-commit hook, environment variables):
`docs/setup/local-development.md`.

## Deployment

`apps/api` ships as a Docker image (`apps/api/Dockerfile`) to Fly.io (`apps/api/fly.toml`) and is
live; deploy steps: `docs/runbooks/deploy-api.md`. `apps/web` is live on Vercel Production.

## Current sprint

**Sprint 2** — complete (EPIC 3: web app navigation shell, exam hub pages, Postgres full-text
search). Sprint 3 has not yet started. Backlog: `docs/backlog/BACKLOG.md`.

## Contributing

Branching, commit format, PR checklist, and coding standards: `docs/project-knowledge/06-CODING-STANDARDS.md`.
Documentation requirements (what must be written, and when): `docs/project-knowledge/07-DOCUMENTATION-STANDARDS.md`.

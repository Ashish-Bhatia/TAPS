# TAPS — Coding Standards

## Branching
- `main` — always deployable
- `develop` — integration branch for the current sprint
- `feature/TAPS-<id>-short-slug` — one branch per story
- PRs merge into `develop`; `develop` merges into `main` at sprint end after review

## Commits
Conventional Commits format, referencing the story ID:
```
feat(TAPS-3.2): add exam hub page routing
fix(TAPS-4.1): correct adaptive difficulty weighting
docs(TAPS-2.4): update data model for StudyMaterial
```

## Pull Requests
Every PR description includes:
- Story ID + one-line summary
- What changed
- How it was tested
- Doc(s) updated (link the file)
- Screenshot/GIF for any UI change

## Code Style
- TypeScript strict mode everywhere (`apps/web`, `apps/mobile`, `apps/api`, `packages/*`)
- ESLint + Prettier enforced via pre-commit hook (Husky) and CI — no manual style debates
- No `any` without an inline comment justifying it
- Functions/components: single responsibility; files over ~300 lines are a signal to split

## Testing
- Unit tests: Jest, colocated as `*.test.ts`
- API integration tests: Supertest against a test DB
- Minimum bar to merge: new logic has tests; nothing merges with failing CI

## Environment & Secrets
- `.env.example` committed, real `.env` never committed (in `.gitignore`)
- Secrets (Anthropic API key, DB URL, S3 keys) via GitHub Actions secrets / Codespaces secrets — never hardcoded, never in chat transcripts

## Review Checklist (applied by Claude to its own PRs before calling a story Done)
- [ ] Matches acceptance criteria exactly
- [ ] Tests pass locally and in CI
- [ ] No secrets/keys in diff
- [ ] Docs updated
- [ ] No TODOs left without a linked follow-up story

# Runbook — Deploy `apps/api` to Fly.io

Prep work for this runbook is tracked as `TAPS-1.16` in `docs/backlog/BACKLOG.md`. The Docker
image and `fly.toml` are in place; the steps below are founder-only account/platform actions
(GitHub Actions secrets, Codespaces secrets — never hardcoded, never in chat transcripts, per
`docs/project-knowledge/06-CODING-STANDARDS.md`) that Claude Code cannot perform.

## Prerequisites (founder-only)

1. Install the `flyctl` CLI and run `fly auth login`.
2. Decide the real app name and region, then edit `apps/api/fly.toml`:
   - `app = 'taps-api'` is a placeholder — rename it (must be globally unique on Fly), or run
     `fly apps create <name>` and update this field to match.
   - `primary_region = 'iad'` is a placeholder — pick the region closest to expected users.
3. Create the app on Fly (first deploy only): `fly apps create <name>` (skip if step 2 already
   created it).
4. Set production secrets on Fly (never commit real values — see `apps/api/.env.example` for the
   full list):
   ```bash
   fly secrets set DATABASE_URL=... ANTHROPIC_API_KEY=... ALLOWED_ORIGIN=https://<web-app-domain> \
     --config apps/api/fly.toml
   ```

## Deploy

The repo is an npm-workspaces monorepo with a single root lockfile, so `apps/api/Dockerfile`
needs the **repo root** as its build context even though `fly.toml` lives in `apps/api/`. Run
from the repo root:

```bash
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile .
```

Fly reads the health check from `fly.toml`'s `[[http_service.checks]]` block (`GET /health`,
matching `apps/api/src/health/health.controller.ts`) and won't route traffic to a machine until
it passes.

## Verify

```bash
fly status --config apps/api/fly.toml
curl https://<app-name>.fly.dev/health   # expect {"status":"ok"}
```

## Rollback

```bash
fly releases --config apps/api/fly.toml
fly deploy --config apps/api/fly.toml --image <previous-image-ref>
```

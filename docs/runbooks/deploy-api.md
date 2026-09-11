# Runbook — Deploy `apps/api` to Fly.io

Prep work for this runbook is tracked as `TAPS-1.16` in `docs/backlog/BACKLOG.md`. The Docker
image and `fly.toml` are in place; the steps below are founder-only account/platform actions
(GitHub Actions secrets, Codespaces secrets — never hardcoded, never in chat transcripts, per
`docs/project-knowledge/06-CODING-STANDARDS.md`) that Claude Code cannot perform.

## Automated deploy (as of TAPS-1.22)

Every push to `main` that passes CI now deploys `apps/api` automatically via
`.github/workflows/deploy-api.yml`, then runs `.github/scripts/smoke-test-api.sh` against the real
deployed URL — `GET /health`, a throwaway user register+login, and an admin login, not just
liveness (see `docs/adr/017-api-ci-deploy-pipeline.md` for why). **Manual `fly deploy` below is now
the fallback/rollback path, not the normal path.**

Two GitHub Actions repo secrets are required for the automated pipeline to work (founder-only —
Settings → Secrets and variables → Actions):

- `FLY_API_TOKEN` — generate with `fly tokens create deploy --config apps/api/fly.toml`.
- `SMOKE_ADMIN_PASSWORD` — the real admin **plaintext** password matching the `ADMIN_PASSWORD_HASH`
  currently set on the `taps-api` Fly app (see `TAPS-1.23`'s entry in `docs/backlog/BACKLOG.md` for
  which password that is). A separate secret from `ADMIN_PASSWORD_HASH` deliberately — the hash
  can't be reversed to log in with.

Until both are set, `deploy-api.yml` fails loudly (at the `flyctl deploy` step, or at the admin-auth
smoke-test step) rather than silently skipping — check the Actions tab after the first push to
`main` following this story.

Known side effect: the smoke test registers one throwaway user (`smoke-test+<timestamp>-<rand>@taps-smoke-test.invalid`)
against the real production database on every deploy — no cleanup step exists yet. Accepted for
now; see `docs/adr/017-api-ci-deploy-pipeline.md`.

## Prerequisites (founder-only, first deploy only)

1. Install the `flyctl` CLI and run `fly auth login`.
2. Decide the real app name and region, then edit `apps/api/fly.toml`:
   - `app = 'taps-api'` is a placeholder — rename it (must be globally unique on Fly), or run
     `fly apps create <name>` and update this field to match.
   - `primary_region = 'iad'` is a placeholder — pick the region closest to expected users.
3. Create the app on Fly (first deploy only): `fly apps create <name>` (skip if step 2 already
   created it).
4. Set production secrets on Fly (never commit real values — see `apps/api/.env.example` for the
   full list, including how to generate `JWT_SECRET` and `ADMIN_PASSWORD_HASH`, added in
   `TAPS-2.3` — see `docs/adr/005-admin-auth-and-validation.md`):
   ```bash
   fly secrets set DATABASE_URL=... ANTHROPIC_API_KEY=... ALLOWED_ORIGIN=https://<web-app-domain> \
     JWT_SECRET=... ADMIN_PASSWORD_HASH=... \
     --config apps/api/fly.toml
   ```

## Manual deploy (fallback)

The repo is an npm-workspaces monorepo with a single root lockfile, so `apps/api/Dockerfile`
needs the **repo root** as its build context even though `fly.toml` lives in `apps/api/`. Run
from the repo root:

```bash
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile .
```

Fly reads the health check from `fly.toml`'s `[[http_service.checks]]` block (`GET /health`,
matching `apps/api/src/health/health.controller.ts`) and won't route traffic to a machine until
it passes. After a manual deploy, also run the same smoke test the pipeline runs:

```bash
API_URL=https://taps-api.fly.dev SMOKE_ADMIN_PASSWORD=... .github/scripts/smoke-test-api.sh
```

## Verify

```bash
fly status --config apps/api/fly.toml
curl https://<app-name>.fly.dev/health   # expect {"status":"ok"}
```

## CORS Configuration (TAPS-1.16)

- `ALLOWED_ORIGIN` on the `taps-api` Fly app is set to `https://taps-web-eta.vercel.app`
  (**no trailing slash**). `apps/api/src/main.ts` passes this value straight into NestJS's
  `app.enableCors({ origin: ... })`, which sends it back as a fixed `Access-Control-Allow-Origin`
  header on every response — it is not a dynamic allowlist that checks the incoming `Origin`
  header, so the env var's exact string (scheme, host, no path, no trailing slash) is what the
  browser compares against the page's own origin.
- `https://taps-web-eta.vercel.app` is the **Vercel Production** URL for `apps/web`, and Vercel is
  configured so Production only builds/deploys on pushes to `main` (Preview deployments on other
  branches/PRs get their own, different, unlisted-in-CORS URLs and won't pass this check).
- Verify the header is present and matches exactly:
  ```bash
  curl -sI -H "Origin: https://taps-web-eta.vercel.app" https://taps-api.fly.dev/health \
    | grep -i access-control-allow-origin
  # expect: access-control-allow-origin: https://taps-web-eta.vercel.app
  ```

## Rollback

```bash
fly releases --config apps/api/fly.toml
fly deploy --config apps/api/fly.toml --image <previous-image-ref>
```

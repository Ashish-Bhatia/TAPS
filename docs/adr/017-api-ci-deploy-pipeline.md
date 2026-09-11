# 017 — `apps/api` CI-driven deploy pipeline and post-deploy smoke test

Status: Accepted

## Context

Until now, deploying `apps/api` to Fly.io has been a manual step (`docs/runbooks/deploy-api.md`):
someone runs `fly deploy` from their own machine after merging to `main`. Fly, unlike Vercel (which
auto-builds `apps/web` on every push to `main`), never deploys on push by itself — nothing forces
a deploy to actually happen, or to happen from the merged code rather than a stale local checkout.

Sprint 4's close-out (`docs/sprints/sprint-04-summary.md`) documents the concrete failure this
caused: a `main`-sync deploy where `/health` passed and gave false confidence while user
registration and admin auth were both silently broken in production — the third time this general
shape of incident (a shallow check passing while a real capability underneath is broken) has
happened. `TAPS-1.22` exists specifically to close this gap, with acceptance criteria written
around that incident: an automated pipeline whose post-deploy check exercises real auth flows, not
just liveness.

Two decisions here have real trade-offs.

## 1. Trigger: `workflow_run` off the existing CI workflow, not a parallel job

**Options considered:**

- **A. A job in `ci.yml` itself**, gated on the existing `lint-and-test` job via `needs:` and an
  `if: github.ref == 'refs/heads/main'` check.
- **B. A separate `deploy-api.yml` workflow, triggered by `workflow_run` on CI's completion**,
  gated on `github.event.workflow_run.conclusion == 'success'` and
  `github.event.workflow_run.head_branch == 'main'`.

**Decision:** B. `ci.yml`'s existing `push: branches: [main]` trigger already runs lint/test/format
on every push to `main` (including a merge commit); a `workflow_run` listener lets deploy be a
fully separate concern — different failure/notification surface, different permissions (needs the
`FLY_API_TOKEN` secret; CI doesn't), and it can be disabled/re-run independently of CI without
touching the CI workflow file. The one real gotcha: `workflow_run` runs in the context of the
workflow file **on the default branch**, and must explicitly check out
`github.event.workflow_run.head_sha` (not the ref implied by the trigger) to deploy the actual
commit CI just validated rather than whatever `main` moves to next.

## 2. Post-deploy smoke test: real auth flows against the live deployment, not mocked

**Decision:** after `fly deploy` succeeds, a script
(`.github/scripts/smoke-test-api.sh`) runs against the real deployed URL and:

1. `GET /health` — expects `200 {"status":"ok"}` (kept, as a fast first check).
2. `POST /user-auth/register` with a throwaway, randomly-generated email + password, expecting
   `201` + `accessToken`, then `POST /user-auth/login` with the same credentials, expecting `200` +
   `accessToken` — exercises the full user-auth path (registration write to the real DB, then a
   real login) with no pre-existing fixture data required.
3. `POST /auth/login` with the real admin password, expecting `200` + `accessToken` — exercises
   admin auth end-to-end against the real deployed `ADMIN_PASSWORD_HASH`, not a copy of it.

Step 3 needs the actual admin **plaintext** password as a GitHub Actions secret
(`SMOKE_ADMIN_PASSWORD`) — deliberately a new, separate secret from `ADMIN_PASSWORD_HASH` (the
hash can't be reversed to smoke-test against). **This is a founder-only action**: someone with
repo-admin access must add it (see `docs/runbooks/deploy-api.md`), same as `FLY_API_TOKEN`. Until
it's set, the workflow's admin-auth step fails loudly (curl gets a `401`/`500` from a step
expecting `200`, not a skip) — silently skipping would recreate exactly the "looked passing, wasn't"
failure mode this story exists to close.

**Consequence / explicitly out of scope:** the smoke test fails the workflow (loud, visible in the
Actions tab and PR/commit status) but does **not** auto-rollback the deploy — the existing
`docs/runbooks/deploy-api.md` "Rollback" section stays a manual, human-triggered step. Auto-rollback
was considered and deferred: it's a genuinely separate decision (what counts as safe to roll back
automatically, whether a partial-traffic Fly deploy needs different handling) and adding it here
would be scope creep on a story whose acceptance criteria only asks for detection, not remediation
(loop-prevention rule 3). Filed as a candidate follow-up story rather than built now.

## Consequences

- Every merge to `main` that touches `apps/api` (or the deploy workflow/scripts themselves) now
  deploys automatically once CI passes — no human has to remember to run `fly deploy`.
- Two new founder-only GitHub Actions secrets are required: `FLY_API_TOKEN` and
  `SMOKE_ADMIN_PASSWORD`. Until both are set, the workflow will fail at the deploy step or the
  admin-auth smoke-test step respectively — see `docs/runbooks/deploy-api.md`.
- The smoke test registers one throwaway user per deploy against the real production database.
  This is a deliberate, accepted cost (no cleanup step exists yet) — flagged in the runbook as a
  known minor side effect, not silently left undocumented.

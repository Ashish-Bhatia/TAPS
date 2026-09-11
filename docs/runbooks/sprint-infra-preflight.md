# Runbook — Sprint infra pre-flight checklist

**Run this at the start of any sprint that will sync `develop` to `main`** (`TAPS-1.25`) — before
opening the first PR that targets `main`, not after something breaks. Each check below has a
real command and what a passing result looks like; record pass/fail for each in that sprint's
`docs/sprints/sprint-NN-summary.md` as evidence it actually ran, not just that this file exists
(see `docs/sprints/sprint-05-summary.md` for the first real run).

Filed after two real production incidents this exact kind of gap caused: Sprint 4's `main`-sync
deploy where a passing `/health` gave false confidence while auth was silently broken
(`docs/sprints/sprint-04-summary.md`), and this very sprint's discovery (below) that `gh api`
silently returns nothing when `GITHUB_TOKEN` shadows the real CLI session — not a hypothetical,
already hit once.

## 1. `GITHUB_TOKEN` isn't shadowing `gh auth`

**Symptom if this is wrong:** `gh api` calls that need real admin scope silently return nothing,
or 403, even though the signed-in account genuinely has admin rights — looks like a permissions
problem, is actually the wrong token being used. Full root cause:
`docs/runbooks/codespaces-gh-token.md` (`TAPS-1.14`).

```bash
echo "GITHUB_TOKEN is set: ${GITHUB_TOKEN:+yes}"
env -u GITHUB_TOKEN -u GH_TOKEN gh auth status
```

**Pass:** `gh auth status` (run with `GITHUB_TOKEN`/`GH_TOKEN` excluded) shows the expected
account, logged in, with the scopes the sprint's work needs (at minimum `repo`; `admin:repo_hook`
if the sprint touches branch protection or repo security settings). If `GITHUB_TOKEN` is set in
the ambient environment (Codespaces sets one by default), prefix every `gh`/`git push` command
that needs real admin scope with `env -u GITHUB_TOKEN -u GH_TOKEN` for the rest of the sprint,
rather than unsetting it globally (other tooling may expect it present).

## 2. `default_branch` is `develop`

**Why this matters:** this repo's standing process is "develop accumulates, main syncs at sprint
end" (`docs/adr/`, sprint summaries) — PRs should target `develop` by default. If GitHub's own
default branch setting ever drifted to `main`, every new PR/branch created without an explicit
`--base` would silently target the wrong branch.

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh api repos/Ashish-Bhatia/TAPS --jq '.default_branch'
```

**Pass:** prints `develop`. If it prints `main`, this is a real misconfiguration to fix (via repo
Settings → General → Default branch) before continuing the sprint, not something to route around
per-PR.

## 3. `enforce_admins.enabled` is `true` on both `main` and `develop`

**Why this matters:** without this, an admin account (which every account with push access to a
personal-account repo effectively is) can bypass branch protection entirely — required status
checks, PR review requirements, everything — making the protection rules decorative rather than
enforced.

```bash
env -u GITHUB_TOKEN -u GH_TOKEN gh api repos/Ashish-Bhatia/TAPS/branches/main/protection \
  --jq '.enforce_admins.enabled'
env -u GITHUB_TOKEN -u GH_TOKEN gh api repos/Ashish-Bhatia/TAPS/branches/develop/protection \
  --jq '.enforce_admins.enabled'
```

**Pass:** both print `true`. A `404` on either call usually means branch protection isn't
configured on that branch at all (a bigger gap than `enforce_admins` being `false`) — check repo
Settings → Branches directly.

## Recording results

Add a short table like this to the sprint's summary doc:

| Check                             | Result | Notes |
| --------------------------------- | ------ | ----- |
| `GITHUB_TOKEN` not shadowing `gh` | ✅/❌  | —     |
| `default_branch` is `develop`     | ✅/❌  | —     |
| `enforce_admins` true (main)      | ✅/❌  | —     |
| `enforce_admins` true (develop)   | ✅/❌  | —     |

A ❌ on any row means: stop and fix that item before opening PRs against `main` this sprint, per
`10-LOOP-PREVENTION-PROTOCOL.md` rather than working around it silently.

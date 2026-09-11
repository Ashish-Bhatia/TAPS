# Runbook — `gh` CLI 403s inside a Codespace despite admin rights

Tracked as part of closing out `TAPS-1.14` in `docs/backlog/BACKLOG.md`.

## Symptom

`gh api` calls that need elevated scope — e.g. reading or writing branch protection
(`repos/{owner}/{repo}/branches/{branch}/protection`) — return `403 Forbidden`, even though the
signed-in GitHub account genuinely has admin rights on the repo.

## Root cause

GitHub Codespaces auto-injects a `GITHUB_TOKEN` environment variable into every Codespace by
default. That token is deliberately scoped down (no `admin:repo_hook`, no repo-admin
branch-protection access) and takes priority over the real, separately authenticated `gh` CLI
session — `gh` and any tool using the `GITHUB_TOKEN`/`GH_TOKEN` env vars will silently use this
shadowing token instead of the one from `gh auth login`/`gh auth status`. The 403 looks like an
account-permission problem, but it is really the wrong token being used.

## Fix

```bash
unset GITHUB_TOKEN
gh auth refresh -h github.com -s repo,admin:repo_hook
```

`gh auth refresh` re-authenticates the actual `gh` CLI session with the scopes the task needs,
now that `GITHUB_TOKEN` is no longer shadowing it. Confirm with `gh auth status` that the session
shown is the intended account, then re-run the original `gh api` call.

## When to reach for this

Any time `gh api` unexpectedly 403s inside a Codespace on an endpoint the account should have
access to — check `echo $GITHUB_TOKEN` first; if it's set, that's very likely the cause.

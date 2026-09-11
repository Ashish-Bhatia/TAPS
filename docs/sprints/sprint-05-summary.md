# Sprint 5 (in progress) — CI/CD pipeline, backlog hygiene fixes, tag-based caching

Sprint dates: 2026-09-11 (single continuous session, per `04-AGILE-PROCESS.md`'s "team available
continuously" model). Base: `develop` at `2ade31d` (Sprint 4 close-out). This document is being
written incrementally as the sprint progresses, not only at the end — see
`docs/backlog/BACKLOG.md` for the authoritative live status of every story.

**This is not the sprint's final close-out.** Sections here will be added to as remaining stories
finish; treat the backlog, not this doc, as the source of truth for what's actually Done right now.

## Infra pre-flight (`TAPS-1.25`)

Run for real per `docs/runbooks/sprint-infra-preflight.md`, the first time that checklist has
existed — this run is also what closes out `TAPS-1.25` itself.

| Check                             | Result | Notes                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` not shadowing `gh` | ❌→✅  | Found shadowing FOR REAL mid-sprint while working `TAPS-1.24`: `gh api`'s `security_and_analysis` field came back empty until `GITHUB_TOKEN`/`GH_TOKEN` were excluded from the call. Confirmed clean once excluded — `gh auth status` shows the real `gho_...` session with `repo`+`admin:repo_hook`. |
| `default_branch` is `develop`     | ✅     | `gh api repos/Ashish-Bhatia/TAPS --jq '.default_branch'` → `develop`                                                                                                                                                                                                                                  |
| `enforce_admins` true (`main`)    | ✅     | `gh api .../branches/main/protection --jq '.enforce_admins.enabled'` → `true`                                                                                                                                                                                                                         |
| `enforce_admins` true (`develop`) | ✅     | `gh api .../branches/develop/protection --jq '.enforce_admins.enabled'` → `true`                                                                                                                                                                                                                      |

The `GITHUB_TOKEN`-shadowing row is real, not hypothetical: this exact checklist would have caught
it proactively, at the start of the sprint, instead of it being discovered mid-story while trying
to read/write repo security settings for `TAPS-1.24`.

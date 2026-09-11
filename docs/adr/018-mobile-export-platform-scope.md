# 018 — `apps/mobile`: no web export target

Status: Accepted

## Context

`TAPS-1.19` (found during Sprint 0 verification, `docs/sprints/sprint-00-verification.md`) flagged
that bare `npx expo export` fails in `apps/mobile`:

```
CommandError: It looks like you're trying to use web support but don't have the required
dependencies installed.
Install react-native-web@^0.21.2 by running: npx expo install react-native-web
If you're not using web, please ensure you remove the "web" string from the
platforms array in the project Expo config.
```

The story's own phrasing offered two options: add `react-native-web`, or drop `app.json`'s `web`
config block. Testing both against the real Expo v57 CLI (not assumed from the error text) showed
the second option **does not work**: `expo export`'s default platform set is `all` (iOS, Android,
web), controlled by the CLI's `--platform` flag, not by anything in `app.json`. Removing `app.json`'s
`web` block was still the right call (it's dead config for a target this app never uses — see
below) but it doesn't by itself make bare `expo export` succeed. This is new information the
original story's phrasing didn't have.

`docs/project-knowledge/02-PRODUCT-VISION-AND-PRD.md` §3 scopes the mobile app explicitly:
"Mobile app (Android first, matching source site's existing APK distribution; iOS in Phase 2)" —
web is never mentioned as a mobile target, at any phase.

## Decision

**Do not install `react-native-web`.** Installing it purely to make a CLI default succeed would add
a real dependency (and its transitive footprint) for a platform target that was never part of this
app's product scope — the PRD is Android-first with iOS in Phase 2, nothing about web. That would
be solving a symptom by expanding scope rather than aligning tooling with the actual product plan
(loop-prevention rule 3).

Instead: `apps/mobile` is Android/iOS only.

- `app.json`'s `web` config block removed (dead config for an unused target).
- `package.json`'s `web` script (`expo start --web`) removed — it depended on the same missing
  dependency and would fail identically if run.
- **Convention going forward:** any `expo export` invocation (CI, EAS build config, or a future
  script) must pass `--platform` **repeated once per platform** — `--platform android --platform
ios` (a single comma-separated `--platform android,ios` is rejected: `CommandError: Unsupported
platform "android,ios"`, verified against the real v57 CLI). Bare `npx expo export` will continue to
  fail until/unless web becomes an actual mobile target — this is expected, not a bug, and this
  ADR is the record of why.

**Consequence:** nothing in this repo currently calls `expo export` at all (confirmed via repo-wide
grep) — this failure mode doesn't block CI or any documented workflow today. This story closes the
gap for the future case (someone runs the bare command locally, or wires up an export/build step
without knowing to pass `--platform`) by documenting the required invocation here rather than by
installing an unused dependency to make the default silently work.

**Revisit when:** mobile web actually becomes a product goal (would need its own PRD-level
decision, not a side effect of a CLI-default bug fix) — at that point, install `react-native-web`
per the CLI's own suggested fix and restore `app.json`'s `web` block.

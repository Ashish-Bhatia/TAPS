# Runbook — GitHub secret scanning & push protection status (`TAPS-1.24`)

## Current state (verified 2026-09-11 via `gh api repos/Ashish-Bhatia/TAPS`)

| Setting                                 | Status      | How verified                                                                                                |
| --------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `secret_scanning`                       | ✅ Enabled  | `gh api` read, real, after enabling via `PATCH`                                                             |
| `secret_scanning_push_protection`       | ✅ Enabled  | `gh api` read, real, after enabling via `PATCH`                                                             |
| `dependabot_security_updates`           | ✅ Enabled  | `gh api` read + corroborated live: a real `git push` printed GitHub's own "18 vulnerabilities found" notice |
| `secret_scanning_non_provider_patterns` | ❌ Disabled | 2 real `PATCH` attempts, both left it disabled — see below                                                  |
| `secret_scanning_validity_checks`       | ❌ Disabled | 2 real `PATCH` attempts, both left it disabled — see below                                                  |

## A real gotcha hit while doing this: `GITHUB_TOKEN` shadowed `gh`'s own credential

`gh api repos/Ashish-Bhatia/TAPS --jq '.security_and_analysis'` returned nothing at all — not
`false`, not an error, just an empty/absent field — until the ambient `GITHUB_TOKEN` env var
(an ephemeral, more limited Actions-issued token) was excluded with `env -u GITHUB_TOKEN -u
GH_TOKEN gh api ...`, at which point `gh` fell back to its own stored, admin-scoped OAuth
credential and returned real data. **This is exactly the failure mode `TAPS-1.25`'s pre-flight
checklist is meant to catch proactively** — this is now a confirmed live instance of it, not a
hypothetical.

## BLOCKED: `secret_scanning_non_provider_patterns` / `secret_scanning_validity_checks` won't enable

**Tried:**

1. Single combined `PATCH` setting all five `security_and_analysis` sub-fields to `enabled` at
   once. Result: 3/5 took; these 2 stayed `disabled` in the same response.
2. A follow-up `PATCH` targeting only these 2, now that `secret_scanning` was confirmed already
   `enabled` (in case of an ordering/dependency issue). Result: unchanged, still `disabled`.

**What real diagnosis (not guessing) turned up:** GitHub's own documentation states "validity
checks are not supported for non-provider patterns" — these two settings may have a genuine,
documented incompatibility with each other, or (more likely given `Ashish-Bhatia` is a personal
account, not an organization) `secret_scanning_non_provider_patterns` and
`secret_scanning_validity_checks` may simply not be available via the public-repo free tier for a
personal-account repo the way base `secret_scanning`/`push_protection` are — those two became free
for all public repos in 2023, but these more advanced toggles may still require GitHub Advanced
Security (org/Enterprise) even on a public repo.

**Options:**

- A) Accept 3/5 as the real, correct end state for a personal-account public repo — close
  `TAPS-1.24`'s scope to what's actually available here, and note the other 2 as not applicable
  rather than not-yet-done.
- B) Ashish checks the repo's Settings → Code security page directly in the browser — the UI
  sometimes surfaces an explanation the API doesn't (e.g. "requires GitHub Advanced Security",
  a Learn More link, or a one-time consent click the API can't complete on its own).

**Recommendation:** A — this looks like a real platform limitation, not a fixable configuration
error, and matches AC's own phrasing implying a repo-admin action Claude Code might not be able to
complete alone. Needs Ashish's confirmation either way.

## BLOCKED: push protection didn't block a known-test secret pattern

**Acceptance criterion:** "Given push protection is enabled, when a commit containing a known
secret test-pattern (not a real credential) is pushed on a disposable branch, then the push is
blocked with a clear error."

**Tried** (each on its own disposable branch, pushed then immediately deleted — no real secret
involved, both are AWS's own well-known public documentation placeholders):

1. `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE` alone. Push succeeded — **not blocked**.
2. A matched pair — `AKIAIOSFODNN7EXAMPLE` + AWS's paired example secret key
   (`wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`) in the same file, informed by real research
   turning up that GitHub's AWS pattern requires the ID and secret to co-occur in one file to
   match. Push still succeeded — **still not blocked**.

**What real diagnosis turned up:** this exact AWS example pair is used across essentially every
AWS SDK's official documentation — GitHub plausibly allowlists it specifically to avoid flooding
every repo containing AWS tutorial code with false-positive alerts. That's a reasonable
explanation but unconfirmed.

**Per the two-strike rule (`10-LOOP-PREVENTION-PROTOCOL.md`), stopped here** rather than trying a
third secret pattern unsupervised.

**Options:**

- A) Try a genuinely non-placeholder-shaped test secret next — e.g. a fake but correctly-formatted
  GitHub personal access token (`ghp_` + 36 random-looking chars) or Slack token, which are less
  likely to be a universally-known documentation example GitHub would specifically allowlist.
- B) Ashish tests this once directly (a real push from their own machine/account) since GitHub's
  push protection UI sometimes shows richer diagnostic info (which pattern almost matched, why it
  didn't) than the API/CLI push output does.

**Recommendation:** A, as a quick next attempt if Ashish wants it tried — but this needs
sign-off first per the two-strike rule rather than being retried unsupervised in the same session.

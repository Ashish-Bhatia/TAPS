# Runbook — GitHub secret scanning & push protection status (`TAPS-1.24`)

**Status: closed as Done, 2026-09-11** — 3/5 settings enabled and verified; the remaining 2 are a
documented, accepted platform limitation, not an open gap. Kept as a reference so this doesn't get
re-investigated as a mystery later.

## Final state (secret_scanning/push_protection/dependabot verified directly in the GitHub UI by Ashish; validity_checks/non_provider_patterns confirmed absent from the UI, also by Ashish)

| Setting                                 | Status                                | How verified                                                                               |
| --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `secret_scanning`                       | ✅ Enabled                            | `gh api` + confirmed live in Settings → Code security UI                                   |
| `secret_scanning_push_protection`       | ✅ Enabled                            | `gh api` + confirmed live in UI + a real blocked push (see below)                          |
| `dependabot_security_updates`           | ✅ Enabled                            | `gh api` + corroborated live: a real `git push` printed GitHub's own vulnerability notice  |
| `secret_scanning_non_provider_patterns` | 🚫 Not available on this account tier | Confirmed absent from the Settings UI entirely — not greyed out, not gated, just not there |
| `secret_scanning_validity_checks`       | 🚫 Not available on this account tier | Confirmed absent from the Settings UI entirely — not greyed out, not gated, just not there |

## A real gotcha hit while investigating this: `GITHUB_TOKEN` shadowed `gh`'s own credential

`gh api repos/Ashish-Bhatia/TAPS --jq '.security_and_analysis'` returned nothing at all — not
`false`, not an error, just an empty/absent field — until the ambient `GITHUB_TOKEN` env var
(an ephemeral, more limited Actions-issued token) was excluded with `env -u GITHUB_TOKEN -u
GH_TOKEN gh api ...`, at which point `gh` fell back to its own stored, admin-scoped OAuth
credential and returned real data. **This is exactly the failure mode `TAPS-1.25`'s pre-flight
checklist is meant to catch proactively** — this is now a confirmed live instance of it, not a
hypothetical.

## RESOLVED: `secret_scanning_non_provider_patterns` / `secret_scanning_validity_checks`

**What was tried:** 2 real `PATCH` attempts via `gh api` (a combined call, then a targeted
follow-up) — both left these 2 disabled. Real diagnosis at the time suspected either a documented
incompatibility between the two settings, or a personal-account (non-Enterprise) platform
limitation.

**Confirmed by Ashish directly in the GitHub UI** (`Settings → Code security`,
`https://github.com/Ashish-Bhatia/TAPS/settings/security_analysis`): these two don't appear on the
page at all for this account — not greyed out, not behind a clickable "Upgrade to GitHub Advanced
Security" prompt, just genuinely absent. **This is a real account-tier platform limitation**, not
something the API/CLI missed or a step Claude Code left undone. Closed as an accepted limitation —
`TAPS-1.24`'s scope is what's actually available for a personal-account public repo, which is now
fully enabled.

## RESOLVED: push protection blocking a known-test secret pattern

**Acceptance criterion:** "Given push protection is enabled, when a commit containing a known
secret test-pattern (not a real credential) is pushed on a disposable branch, then the push is
blocked with a clear error."

**3 real attempts, each on its own disposable branch (pushed, then discarded — no real secret ever
involved):**

1. `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE` alone. Pushed clean — not blocked.
2. That same key, paired with AWS's own matching example secret key
   (`wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`) in one file — informed by real research that
   GitHub's AWS pattern needs ID+secret to co-occur. Still pushed clean — not blocked.
3. **A fake but correctly-formatted GitHub Personal Access Token (`ghp_` + 36 chars) — genuinely
   blocked**, with a clear error:
   ```
   remote: error: GH013: Repository rule violations found for refs/heads/...
   remote: - GITHUB PUSH PROTECTION
   remote:     - Push cannot contain secrets
   remote:       —— GitHub Personal Access Token ——————
   remote:        locations: commit <sha>, path: push-protection-test.txt:1
   ```
   The push was rejected outright — nothing ever reached GitHub's servers as a real commit.

**Conclusion:** push protection was working correctly the entire time. Attempts 1–2 failed to
trigger it because GitHub plausibly allowlists that exact, famous AWS documentation example pair
specifically to avoid flooding every repo containing AWS tutorial code with false positives — not
because push protection itself was broken or unconfigured. Attempt 3, using a genuinely distinct
fake secret, confirms the real behavior AC #2 asks for.

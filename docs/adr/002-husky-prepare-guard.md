# 002 — Guard the root `prepare` script for production/CI installs

Status: Accepted

## Context

ADR 001 set the root `prepare` script to `"husky"`, which is correct for a normal developer
`npm install` on a full git checkout. It breaks on platform deploys (Vercel and similar) whose
`npm install`/`npm ci` runs without `husky` present and/or without a full git working copy —
`npm run prepare` then fails with `sh: husky: command not found` and blocks the deploy.
GitHub Actions CI is unaffected: `.github/workflows/ci.yml` uses a real git checkout
(`actions/checkout@v4`) and plain `npm ci`, which installs `devDependencies` (including
`husky`), so the `prepare > husky` step there completes cleanly.

Husky's own docs (typicode.github.io/husky/how-to.html, "CI server and Docker") describe two
ways to make `prepare` tolerate a missing `husky`: `"prepare": "husky || true"`, or a
`.husky/install.mjs` script that exits early. A first attempt at the `.mjs` guard checked
`NODE_ENV === 'production'` / `CI === 'true'` before importing `husky` — that still failed on
Vercel, because Vercel's build environment doesn't necessarily set either variable to those
exact values. Guessing at which environment variable a given platform sets is inherently
fragile; the actual failure is `husky` being unimportable, not a particular env var being (or
not being) set.

## Decision

Guard the import itself with `try`/`catch` instead of pre-checking environment variables:

```js
// .husky/install.mjs
try {
  const husky = (await import('husky')).default;
  console.log(husky());
} catch (e) {
  process.exit(0);
}
```

Root `package.json`'s `prepare` script is `"node .husky/install.mjs"`. Any reason `husky` is
unavailable — not installed, no `.git` directory, any other import-time failure, on any
platform — is caught and the script exits `0` silently, rather than trying to enumerate the
platform-specific conditions that would need it to.

Verified locally:

- `npm install` at repo root with `husky` present: `prepare` runs, exits 0, `.husky/_` is
  populated with all 16 hook files (normal behavior, unchanged).
- With `node_modules/husky` renamed away (simulating it being unavailable) and `npm run prepare`
  re-run directly: exits 0 with no output and no thrown error; `.husky/_` is left untouched
  (no partial install attempted).

## Consequences

- **Easier:** the guard no longer depends on knowing or guessing which environment variable a
  deploy platform sets — it reacts to the actual failure (an unimportable `husky`), so it covers
  Vercel's case and any other platform/condition with the same underlying cause.
- **Harder:** none identified — local developer installs are unaffected, hooks still install
  normally whenever `husky` is importable.
- Supersedes the first version of this guard (env-var pre-check), which is what this ADR
  documents; the env-var approach is no longer used anywhere in this repo.

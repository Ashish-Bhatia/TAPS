# 002 — Guard the root `prepare` script for production/CI installs

Status: Accepted

## Context

ADR 001 set the root `prepare` script to `"husky"`, which is correct for a normal developer
`npm install` on a full git checkout. It breaks in two related ways:

- **Vercel** (and similar platform deploys) run `npm install`/`npm ci` against a checkout that is
  not a full git working copy and/or with only production dependencies installed. Husky isn't in
  `node_modules` in that case, so `npm run prepare` fails with `sh: husky: command not found`,
  which fails the whole install and blocks the deploy.
- **GitHub Actions CI** does not hit this: `.github/workflows/ci.yml` uses `actions/checkout@v4`
  (a real `.git` directory is present) and plain `npm ci` (which installs `devDependencies`
  since `NODE_ENV` isn't `production` and no `--omit=dev` flag is passed), so `husky` is present
  and its install step succeeds. Verified against the most recent CI run
  (`gh run view 34423801195 --log`): the `prepare > husky` step completes cleanly with no
  `command not found` output — the failure pattern doesn't currently reach CI, so no masked
  failure exists there today.

Husky's own docs (typicode.github.io/husky/how-to.html, "CI server and Docker") document two
ways to fix this: `"prepare": "husky || true"`, or a `.husky/install.mjs` script that checks
`NODE_ENV`/`CI` and exits before `husky` is required — the docs note the `|| true` form still
prints a confusing `command not found` line even though it no longer fails the build, and
recommend the `.mjs` form as the silent version.

## Decision

Use Husky's documented `.husky/install.mjs` guard:

- `.husky/install.mjs` exits `0` immediately when `NODE_ENV === 'production'` or `CI === 'true'`,
  otherwise dynamically imports `husky` and installs the hooks.
- Root `package.json`'s `prepare` script becomes `"node .husky/install.mjs"`.

## Consequences

- **Easier:** platform installs that skip devDependencies or run outside a git checkout (Vercel)
  no longer fail `npm install`/`npm ci`; no `command not found` noise in any environment.
- **Harder:** none identified — local developer installs are unaffected (`NODE_ENV` unset,
  `CI` unset), hooks still install normally via `npx husky` semantics inside `install.mjs`.
- **Watch item:** this guard is inert in CI today because CI already has `devDependencies` and a
  real git checkout. If CI is ever changed to a production-only install, this same guard would
  silently skip hook installation there too — that's expected (hooks aren't needed in CI) but
  worth remembering if CI's `prepare` step output is ever used as a signal for something else.

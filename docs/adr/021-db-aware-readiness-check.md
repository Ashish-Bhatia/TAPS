# 021 — DB-aware readiness check, separate from `/health`

Status: Accepted

## Context

`TAPS-2.7`: `docs/adr/003-prisma-orm-and-connection-strategy.md` made `PrismaService.onModuleInit`
fail soft — a DB outage at boot logs an error and lets the app start anyway, matching
`/health`'s existing "no DB, no AI calls, so a slow downstream never flaps health" principle. That
ADR's consequences section flagged the resulting gap directly: "worth reconsidering if we ever add
a Kubernetes-style readiness probe that should reflect DB health specifically." Nothing in the app
currently answers "can this instance actually reach the database right now" — a real question for
an operator diagnosing a machine, or any future orchestration that wants to route around an
instance whose DB connection is down without waiting for every request to it to fail first.

## Decision

Add `GET /ready` (`apps/api/src/health/readiness.controller.ts`), deliberately a separate route
from `GET /health`, not a mode/query-param on the same one — mixing them back together would
reintroduce exactly the failure mode ADR-003 designed away from (a DB blip taking a
liveness-checked machine out of rotation). `/ready` runs a real, trivial, side-effect-free query
(`SELECT 1` via `PrismaService.$queryRaw`) and returns:

- `200 { status: 'ok' }` if the query succeeds.
- `503 { status: 'error', reason: 'database unreachable' }` (via Nest's
  `ServiceUnavailableException`) if it throws.

`fly.toml`'s `http_service.checks` still points at `/health` only — this story does not change what
Fly itself uses to decide machine health, since that would be the exact regression ADR-003 avoided.
`/ready` exists for callers that specifically want DB-aware status.

Why a live query rather than checking whether `$connect()` succeeded at boot: Prisma connects
lazily on first use regardless of whether the explicit `$connect()` call in `onModuleInit`
succeeded (that call is a fail-fast/warm-pool optimization, not a requirement — see ADR-003), so a
boot-time flag would only prove the database was reachable once, in the past, not that it is now.
A real query is the only thing that actually answers the current question.

## Verification — real, not mocked

Per this project's evidence standard (`TAPS-1.22`'s smoke test, `TAPS-3.7`'s cache mechanism,
`TAPS-2.6`'s release_command), verified against real DB-up and real DB-down states, not asserted
via a mocked Prisma client (a mocked-client unit test exists too —
`apps/api/src/health/readiness.controller.spec.ts` — but only as a wiring/config-drift guard, not
as the evidence this claim rests on):

1. **Real DB-up:** built the real `apps/api` (`nest build`) and ran it (`node dist/main.js`) with
   the real Neon `DATABASE_URL`. `curl /ready` → `200 {"status":"ok"}`.
2. **Real DB-down:** ran the identical build with `DATABASE_URL` pointed at a genuinely unreachable
   address (`127.0.0.1:1`, a port nothing listens on, `connect_timeout=3`) — a real TCP connection
   attempt that really fails, not a stub. `curl /ready` → `503
{"status":"error","reason":"database unreachable"}`, with a real
   `PrismaClientInitializationError` logged server-side. `curl /health` on the same, DB-down
   instance → still `200 {"status":"ok"}`, confirming the two endpoints are genuinely decoupled as
   designed, not just decoupled on paper.

Both runs used the actual compiled app (not a test harness double), against real or really-broken
network endpoints, with the process cleaned up (killed) and the temporary env files (which briefly
held real credentials) deleted immediately after.

## Consequences

- Operators/tooling now have a real DB-aware endpoint to check without risking a DB blip flapping
  Fly's liveness check.
- `/ready` is not currently wired into anything (no orchestration consumes it yet) — it's
  infrastructure for a need ADR-003 anticipated, not a currently-required integration. Wiring it
  into Fly's `checks` (as a second, non-liveness check type) or any future orchestration is a
  separate decision, deliberately not made here (loop-prevention rule 3 — ship the smallest change
  that satisfies the story, file bigger ideas as follow-ups).

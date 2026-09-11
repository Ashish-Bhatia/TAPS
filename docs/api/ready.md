# `GET /ready`

DB-aware readiness probe (`TAPS-2.7`). Deliberately separate from [`GET /health`](health.md), which
stays DB-independent by design — see `docs/adr/021-db-aware-readiness-check.md`.

- **Auth:** none
- **Response (DB reachable):** `200 OK`, `{ "status": "ok" }`
- **Response (DB unreachable):** `503 Service Unavailable`,
  `{ "status": "error", "reason": "database unreachable" }`
- Runs a real, trivial, side-effect-free query (`SELECT 1`) through `PrismaService` on every call —
  it answers "can this instance reach the database right now", not "did it once at boot". Source:
  `apps/api/src/health/readiness.controller.ts`.
- Not currently wired into Fly's `http_service.checks` or any orchestration — it exists for a
  caller (an operator, or future tooling) that specifically wants DB-aware status, without risking
  a DB blip taking an otherwise-healthy machine out of rotation via the liveness check.

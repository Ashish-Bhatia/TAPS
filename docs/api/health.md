# `GET /health`

Liveness/readiness probe. Used by Fly.io's `http_service.checks` (`apps/api/fly.toml`) to decide
whether a machine is healthy and should receive traffic.

- **Auth:** none
- **Response:** `200 OK`, `{ "status": "ok" }`
- Deliberately has no dependencies (no DB, no AI calls) so a slow downstream never flaps the
  check. Source: `apps/api/src/health/health.controller.ts`.

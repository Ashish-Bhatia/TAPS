# Auth

Single-admin JWT auth — see `docs/adr/005-admin-auth-and-validation.md` for why there's no `User`
table yet. Every route below except `POST /auth/login` itself requires the JWT this returns.

## `POST /auth/login`

- **Auth:** none
- **Body:** `{ "password": string }`
- **Response:** `200 OK`, `{ "accessToken": string }` — a JWT (`{ sub: 'admin', role: 'admin' }`
  payload, 12h expiry, `HS256` signed with `JWT_SECRET`)
- **Errors:**
  - `401 Unauthorized` — wrong password
  - `500 Internal Server Error` — `ADMIN_PASSWORD_HASH` isn't configured (misconfiguration, not a
    bad login attempt)

Use the token on every other endpoint below as `Authorization: Bearer <accessToken>`. A missing,
malformed, invalid, or expired token gets `401 Unauthorized` (see
`apps/api/src/auth/jwt-auth.guard.ts`); a request with no `JWT_SECRET` configured at all gets
`500 Internal Server Error` (misconfiguration, distinguished from an actual bad token).

# Auth

Single-admin JWT auth for the CMS. This is **not** the end-user account system — as of `TAPS-5.1`
there is a real `User` table and a fully separate `apps/api/src/user-auth/` module (its own guard,
JWT secret, and claim shape); see `docs/api/user-auth.md` and
`docs/adr/014-user-auth-separate-from-admin-auth.md` for that and why the two are deliberately
never merged. This doc covers only the original single-admin-credential system — see
`docs/adr/005-admin-auth-and-validation.md` for why it was built that way. Every route below
except `POST /auth/login` itself requires the JWT this returns.

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

# User auth

End-user account registration and login (`TAPS-5.1`) — a system deliberately separate from the
admin CMS auth documented in `docs/api/auth.md`. See
`docs/adr/014-user-auth-separate-from-admin-auth.md` for why: different identity source (a real
`User` table vs. one shared admin credential), a different JWT signing secret
(`USER_JWT_SECRET`, not `JWT_SECRET`), a different guard (`UserJwtAuthGuard`, not `JwtAuthGuard`),
and a different token payload shape (`{ userId, email }`, no `role`/`admin` claim). A token from
one system is never valid against the other's guard.

## `POST /user-auth/register`

- **Auth:** none
- **Body:**
  ```json
  { "email": "string (valid email)", "password": "string (8–72 chars)", "name": "string, optional" }
  ```
- **Response:** `201 Created`, `{ "accessToken": string }` — a JWT (`{ userId, email }` payload,
  7-day expiry, `HS256` signed with `USER_JWT_SECRET`)
- **Errors:**
  - `400 Bad Request` — invalid email format, password shorter than 8 characters, or an unknown
    field in the body (global `ValidationPipe`, same `whitelist`/`forbidNonWhitelisted` config as
    the admin API)
  - `409 Conflict` — a `User` with that email already exists (`PrismaExceptionFilter`'s `P2002`
    mapping, same as `Post.slug`'s uniqueness in the admin API)

Password is bcrypt-hashed (10 salt rounds, matching `AuthService`'s config) before it ever reaches
Prisma or the database — the plaintext is never persisted or logged.

## `POST /user-auth/login`

- **Auth:** none
- **Body:** `{ "email": "string", "password": "string" }`
- **Response:** `200 OK`, `{ "accessToken": string }` — same JWT shape as registration
- **Errors:**
  - `401 Unauthorized`, body `{ "message": "Invalid email or password", ... }` — wrong password
    **or** no account exists for that email. Both cases return the identical status, message, and
    response shape; a client cannot distinguish "this email isn't registered" from "this email is
    registered but the password is wrong" (enumeration-safety). A nonexistent-email attempt still
    performs a bcrypt compare (against a fixed dummy hash) rather than short-circuiting, so a
    timing difference doesn't leak which case occurred either — see `UserAuthService.login`.

## Using the token

`Authorization: Bearer <accessToken>` on any endpoint guarded by `UserJwtAuthGuard`. A missing,
malformed, invalid, or expired token gets `401 Unauthorized`; a request when `USER_JWT_SECRET`
isn't configured at all gets `500 Internal Server Error` (misconfiguration, distinguished from a
bad token — same convention as the admin guard). No endpoint uses `UserJwtAuthGuard` yet as of
`TAPS-5.1` — this story is the auth system itself; the first consumer (e.g. a progress dashboard
or quiz-attempt endpoint) is a future EPIC 5 story.

## Verification

Live-verified against the real Neon database with a running server (not just mocked unit tests):
register → `201` with a real JWT; duplicate email → `409`; login with the just-registered
credentials → `200`; wrong password → `401` with the generic message; a nonexistent email → `401`
with the byte-for-byte identical message; invalid email format on register → `400`; too-short
password on register → `400`. The issued JWT was decoded directly to confirm its payload is
exactly `{ userId, email, iat, exp }`. The smoke-test user row was deleted afterward (confirmed: 0
rows remaining, no residue).

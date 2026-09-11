// Deliberately distinct shape from apps/api/src/auth/jwt-payload.interface.ts
// (`{ sub: 'admin', role: 'admin' }`) — no `role`/`admin` claim exists here at
// all, so a user-issued token can never be mistaken for (or escalated into)
// an admin one just by a guard skipping a claim check. See
// docs/adr/014-user-auth-separate-from-admin-auth.md.
export interface UserJwtPayload {
  userId: string;
  email: string;
}

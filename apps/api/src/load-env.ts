// Side-effect-only module: load apps/api/.env into process.env before any
// other module in the import graph evaluates. Must stay the very first
// import in main.ts — ES module evaluation follows the source order of
// import declarations, so this runs before app.module.ts (and everything it
// imports, e.g. AuthModule's `JwtModule.register({ secret:
// process.env.JWT_SECRET })`) is evaluated.
//
// This was a real bug, not a precaution: JWT_SECRET only "happened" to work
// once Prisma Client's own runtime auto-loads .env (see
// node_modules/@prisma/client/runtime/library.js) — but that only fires
// when a PrismaClient is actually *constructed* (during Nest's DI
// instantiation phase), which is well after AuthModule's decorator-time
// `process.env.JWT_SECRET` read. In production (Fly), there's no .env file
// at all — real secrets are already in process.env before Node starts — so
// a missing file here is expected and silently ignored, matching the
// try/catch guard pattern already used for the optional Husky prepare
// script (docs/adr/002-husky-prepare-guard.md).
try {
  process.loadEnvFile();
} catch {
  // No apps/api/.env present (production, or a shell that already exports
  // the real values) — nothing to do.
}

-- TAPS-5.1: add the User model (see docs/project-knowledge/05-ARCHITECTURE.md §4 and
-- docs/adr/014-user-auth-separate-from-admin-auth.md).
--
-- Hand-written rather than taken verbatim from `prisma migrate diff`'s output: this schema has
-- `Unsupported("tsvector")` generated columns on exam_boards/posts (TAPS-3.4), and the diff engine
-- doesn't know how to represent those, so its raw output also included spurious
-- `DROP INDEX ..._searchVector_idx` / `ALTER COLUMN "searchVector" DROP DEFAULT` statements that
-- have nothing to do with this change. See docs/runbooks/database-migrations.md.

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "examTargets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

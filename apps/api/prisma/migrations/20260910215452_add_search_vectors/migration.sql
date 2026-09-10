-- TAPS-3.4: full-text search (docs/adr/009-full-text-search.md). Generated,
-- STORED tsvector columns — Postgres keeps them in sync with title/body
-- (name/description for exam_boards) automatically on every write, so the
-- application never has to remember to update them. setweight ranks
-- title/name matches ('A') above body/description matches ('B') so
-- ts_rank reflects that a keyword in the title is a stronger match.

-- CreateIndex (generated column + GIN index) — exam_boards
ALTER TABLE "exam_boards"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "exam_boards_searchVector_idx" ON "exam_boards" USING GIN ("searchVector");

-- CreateIndex (generated column + GIN index) — posts
ALTER TABLE "posts"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body", '')), 'B')
  ) STORED;

CREATE INDEX "posts_searchVector_idx" ON "posts" USING GIN ("searchVector");

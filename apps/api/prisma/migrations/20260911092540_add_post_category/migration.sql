-- TAPS-3.8: free-form, nullable Post category field (not an enum — see
-- docs/adr/013-post-category-field.md) plus an index for the public
-- endpoint's category filter.
ALTER TABLE "posts" ADD COLUMN "category" TEXT;

CREATE INDEX "posts_category_idx" ON "posts"("category");

# 010 — PastPaper text extraction: `pdf-parse` (v2, `pdfjs-dist`-based)

Status: Accepted

## Context

`TAPS-4.0` needs `PastPaper.fileUrl`'s PDF turned into real text so EPIC 4's quiz generation has
something to generate questions from (`05-ARCHITECTURE.md` §5, `generateQuizFromPaper
(pastPaperId)`). The story named `pdf-parse` as the extraction library — a reasonable default
(the most widely used plain "Buffer in, text out" PDF-text package for Node) — but `pdf-parse`
currently ships two incompatible major lines on npm, and picking between them, plus where
extraction can fail, turned out to have real trade-offs worth recording.

**`pdf-parse@1.x`** (last real release `1.1.1`) is a thin wrapper around a single vendored,
webpack-bundled build of Mozilla's `pdf.js` frozen at version `v1.10.100` (2017). It has no native
dependencies and a tiny install footprint, which looked attractive at first. Two problems surfaced
once it was actually exercised rather than just read:

1. Its published entry point (`index.js`) runs a debug-mode branch guarded by `!module.parent`
   that reads a local test fixture the installed package doesn't ship. `module.parent` is unset
   when the module is loaded through NestJS/Vitest's module loaders (not a plain top-level
   `require()`), so importing the package root throws `ENOENT` immediately on import — before any
   PDF is even involved. Importing the inner implementation module directly
   (`pdf-parse/lib/pdf-parse.js`) sidesteps this, but it's an undocumented, unstable import path.
2. More seriously: while writing this story's unit tests, a byte-identical, well-formed PDF
   buffer parsed successfully or threw `Invalid PDF structure`/`bad XRef entry` depending only on
   whether the Buffer's backing `ArrayBuffer` happened to have a nonzero byte offset inside
   Node's shared small-buffer pool at the time — confirmed by hashing the buffer in both cases and
   getting the identical SHA-256 digest while one parse succeeded and the other failed. That is a
   real bug in how the vendored 2017 `pdf.js` build handles ordinary Node `Buffer`s, not a test
   artifact, and it means `pdf-parse@1.x` can fail unpredictably on a perfectly valid PDF depending
   on unrelated allocation activity elsewhere in the process — unacceptable for a pipeline whose
   whole job is distinguishing "this extraction genuinely failed" from "this extraction
   succeeded."

**`pdf-parse@2.x`** (current, `2.4.5`) is an unrelated rewrite by a different maintainer: pure
TypeScript, CJS+ESM+browser builds, built on the actively maintained `pdfjs-dist@5.x` (current
Mozilla `pdf.js`) rather than a frozen 2017 bundle, with its own real test suite and CI. The same
buffer that triggered the v1 bug above — including the adversarial "shifted pool offset" case —
parses correctly and deterministically under v2. Its cost: a dependency on `@napi-rs/canvas`
(prebuilt native binding, used by `pdfjs-dist` for rendering; not required for plain text
extraction but present either way as a transitive dependency) and a newer, narrower Node engine
range (`>=20.16.0 <21 || >=22.3.0`) — both satisfied by this repo's Node 24 and by a standard
Fly.io Node deploy image (confirmed: `npm install` resolves prebuilt `@napi-rs/canvas-linux-x64-gnu`
binaries with no native compilation step, ~30MB added to `node_modules`).

## Decision

**Use `pdf-parse@2.4.5`'s `PDFParse` class (`new PDFParse({ data: buffer }).getText()`),
not the `v1.1.1` line**, despite `v1` being lighter and dependency-free — a PDF library that can
silently flip between success and failure on identical input is a worse foundation for this
pipeline than one with one real native dependency.

**`PastPaperIngestionService.ingest(pastPaperId, fileUrl)` downloads the PDF itself** via the
platform `fetch` (not `pdf-parse@2`'s own built-in `{ url }` loading option), so this service
controls and can test the download step independently of parsing, per the story's explicit
"downloads the PDF, extracts text" framing.

**Every failure mode collapses to the same outcome: `extractionStatus = FAILED`,
`extractedText` left `null`.** `ingest()` wraps the download + parse in one try/catch and never
throws/rejects — a 404, a network error, a non-PDF response, or a corrupt/empty/unparseable PDF
(`pdf-parse@2` rejects cleanly with a descriptive error — e.g. `Invalid PDF structure.`, `The PDF
file is empty, i.e. its size is zero bytes.` — rather than crashing) all result in the same
`FAILED` write. This is deliberate: the admin `PastPaper` create flow must never fail because a
source PDF was bad, and nothing downstream needs to distinguish _why_ extraction failed, only
_that_ it did, so one status value, not a taxonomy of failure reasons, is the full solution this
story needs.

**Ingestion runs synchronously inside `PastPaperService.create`**, not queued/backgrounded — the
admin create request awaits `ingest()` and returns the `PastPaper` with its final
`extractionStatus` (`DONE` or `FAILED`, never left at `PENDING`) already reflected, satisfying the
acceptance criterion that `extractionStatus` be visible in the admin API response with no extra
polling endpoint. A queued/async version is a reasonable future evolution once upload volume or
PDF size makes a synchronous admin request too slow, but that's real scope this story's
acceptance criteria don't ask for — tracked as a follow-up in `docs/backlog/BACKLOG.md` rather than
built speculatively here.

## Consequences

- **Easier:** `PastPaper` creation and text extraction are one atomic-feeling admin action with no
  separate "check extraction status" step; the `FAILED`/`DONE`/`PENDING` enum gives EPIC 4's future
  quiz generation a trivial, reliable filter (`WHERE extractionStatus = 'DONE'`) for which papers
  actually have usable text; a corrupt/unreachable PDF degrades to a clearly-marked `FAILED` row
  instead of a 500 or a silently-broken create.
- **Harder:** `apps/api`'s deploy now carries a native binding (`@napi-rs/canvas`, via
  `pdfjs-dist`) instead of being pure JavaScript — low risk given prebuilt Linux x64 glibc binaries
  resolve cleanly on both this sandbox and Fly.io's standard Node image, but worth knowing if a
  future deploy target uses musl/Alpine or an unusual architecture, which would need an
  `@napi-rs/canvas-*` prebuild that may not exist. A large or slow-to-download PDF makes the admin
  `POST /past-papers` request itself slow, since extraction is synchronous and in-request (see the
  async-ingestion follow-up above). `extractionStatus` is not re-evaluated on `PATCH
/past-papers/:id` even when `fileUrl` changes — out of this story's scope, also tracked as a
  follow-up.

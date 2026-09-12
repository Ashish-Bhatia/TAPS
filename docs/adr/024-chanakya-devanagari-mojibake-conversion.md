# 024 — Chanakya-font Devanagari mojibake: font identification and conversion

Status: Accepted

## Context

`TAPS-4.6` (filed from a live investigation on 2026-09-12, see `docs/backlog/BACKLOG.md`) found
that `PastPaper cmtyqyy0z0001sahpuyhz0v24`'s Hindi-language sections extract as valid Unicode
(zero `U+FFFD` replacement characters — this is not corrupted/undecodable bytes) that nonetheless
reads as meaningless Latin-range mojibake, e.g. the documented sample `¬˝‡Ÿ-¬òÊ`. The story asked
for two things: identify which legacy pre-Unicode Hindi font (Kruti Dev / Chanakya / DevLys) is
responsible, by cross-referencing known mapping tables, and implement a conversion step in the
extraction pipeline.

## Investigation: which font, and why the mojibake is _symbols_, not plain ASCII

Guessing from the garbled characters alone was a dead end. The classic, heavily-documented failure
mode for Kruti Dev (and its lookalikes) is that Devanagari glyphs sit at ordinary lowercase/
uppercase ASCII code points (e.g. क → `d`, भ → `B` — a Remington-keyboard-style typing scheme), so
naive extraction of Kruti Dev text normally comes out as **plain ASCII gibberish** like `iz'u&i=`.
Our sample is nothing like that: `¬˝‡Ÿ-¬òÊ` decodes to codepoints including U+02DD (HUNGARUMLAUT),
U+2021 (DOUBLE DAGGER), U+25CA (LOZENGE) and U+2211 (SUMMATION) — Latin-1-supplement and symbol
characters that would never appear in genuine Kruti Dev-sourced mojibake. That mismatch was the
first sign that reasoning from the garbled text alone, or from a generic Kruti Dev/DevLys table,
would not reliably identify the font.

Rather than guess further, the real source PDF was fetched directly (`PastPaper.fileUrl`, a public
`.r2.dev` URL — see `docs/audits/2026-09-13-followup.md` for how this file came to exist in R2/the
DB) and its embedded font resources inspected directly:

```
$ python3 -c "... regex over /BaseFont entries ..."
...
BHDVED+Symbol
ETCQOY+ChanakyaBoldItalic
GMOOPG+ChanakyaItalic
LSLLKX+Chanakya
RBDJNH+ChanakyaBold
RIYTCJ+Mitra1
WODXZE+YogeshUltraBold
... (40+ more subset TrueType fonts for the English portions)
```

**This is ground truth, not inference: the font is Chanakya** (plain, Bold, Italic and
BoldItalic weights all embedded), not Kruti Dev and not DevLys. Chanakya is a different, less
commonly discussed member of the same pre-Unicode Hindi-typeface family, but — like the others —
assigns Devanagari glyph shapes to ordinary Latin character-code positions in a Remington-style
scheme.

The remaining question was why the mojibake reads as _symbols_ rather than plain ASCII. The
answer, found in the font object actually used for the Hindi runs (`49 0 obj`,
`/BaseFont/LSLLKX+Chanakya`): it carries a `/ToUnicode` CMap (object `413`). A `ToUnicode` CMap is
supposed to map a font's internal character codes to the _real_ Unicode meaning of each glyph, so
text-extraction tools can recover readable text even from a font with a nonstandard internal
encoding. Decompressing this one shows it maps Chanakya's internal codes to **unrelated Latin-1/
symbol Unicode characters** — e.g. raw code `0xFD → U+02DD` (hungarumlaut), `0xE0 → U+2021`
(double dagger), `0xD7 → U+25CA` (lozenge) — instead of to Devanagari, or being left unmapped
entirely:

```
$ python3 -c "... zlib.decompress the ToUnicode CMap stream (object 413) ..."
92 beginbfrange
<20><20><0020>
...
<fd><fd><02dd>
<e0><e0><2021>
<d7><d7><25ca>
...
endbfrange
```

This is almost certainly an artifact of whatever 1990s/2000s DTP-to-PDF pipeline produced this
paper: the Chanakya glyphs were drawn by redrawing an existing Latin/symbol Type 1 font's outlines,
and the `ToUnicode` CMap generator apparently just carried over that base font's original Adobe
Glyph List names (e.g. code `0xE0`'s glyph, redrawn to look like a Devanagari matra, kept the name
`doubledagger` from whatever font it started as) rather than being told the glyph now means
something in Devanagari. `pdf-parse` (built on `pdfjs-dist`, see `010-pdf-text-extraction.md`)
correctly and dutifully applies this `ToUnicode` CMap during extraction — the bug is upstream, in
the PDF itself, not in our extraction library.

### Deriving and validating the conversion table

Knowing this, the conversion needed two pieces of ground truth, both obtained directly from the
real PDF rather than assumed:

1. **This document's actual `ToUnicode` CMap** (above) — which raw Chanakya code produces which
   garbled Unicode character in `pdf-parse`'s output.
2. **The real Chanakya-to-Devanagari character table** — what each raw Chanakya code is actually
   supposed to mean. Cross-referenced against the Chanakya table in the
   [`manishprajapatidev/hindi-font-converter`](https://github.com/manishprajapatidev/hindi-font-converter)
   project (`js/ch.js`), a small existing open-source Chanakya/Kruti Dev/4CGandhi-to-Unicode
   converter, itself checked against the AGL-preserving-but-glyph-redrawn theory above (its keys
   are exactly the WinAnsi/CP1252 characters a raw byte decodes to, which is expected if the
   original Chanakya TrueType font really does just reuse ordinary Latin-1 byte values as
   glyph-selector codes).

Composing these two (raw code → this document's garbled character, and raw code → real
Devanagari) into one direct "garbled character → correct Devanagari" table, restricted to only the
character codes this document's own `ToUnicode` CMap actually contains (130 of `ch.js`'s ~236
entries are exercised by codes this paper's Chanakya subset actually uses; the rest correspond to
glyphs simply absent from this particular font subset and are not included, rather than guessed),
gives a table that is directly checkable against real data rather than trusted blindly from a
third party. It was then validated against **two independent real samples** from the paper's
bilingual cover page (its "PAPER-I" and "MAIN TEST BOOKLET" headers) — not just the one string
quoted in the backlog:

| Mojibake (real, extracted) | Converts to              | Meaning                                                  |
| -------------------------- | ------------------------ | -------------------------------------------------------- |
| `¬˝‡Ÿ-¬òÊ`                 | `प्रश्न-पत्र`            | "Question Paper" — matches "PAPER-I"                     |
| `◊ÈÅÿ ¬⁄UËˇÊÊ ¬ÈÁSÃ∑§Ê`    | `मुख्य परीक्षा पुस्तिका` | "Main Examination Booklet" — matches "MAIN TEST BOOKLET" |

Both are grammatically correct, contextually exact matches for their known English counterparts —
strong independent confirmation that both the font identification and the derived table are
correct, not coincidental.

The second sample also surfaced a real subtlety: Chanakya, like other Remington-style fonts, types
the pre-base vowel sign ("ि", vowel sign I) _before_ its consonant — matching where it's drawn on
screen — while Unicode stores it _after_ the consonant (and after any half-form/virama conjunct
cluster). A naive one-to-one character substitution left a stray un-relocated marker in the
output (`पुçस्तका` instead of `पुस्तिका`); the implementation includes a small reordering pass to
place it correctly.

## Decision

Added `apps/api/src/ingestion/chanakya-devanagari.ts`, run unconditionally as a post-processing
step on every `PastPaperIngestionService.ingest()` extraction (before the text is persisted):

- `CHANAKYA_MAIN_TABLE` / `CHANAKYA_CLEANUP_TABLE`: the derived, validated substitution tables
  described above.
- `reorderPrebaseVowelSign`: the pre-base-vowel-sign relocation pass.
- **Per-token gating, not whole-document substitution.** A handful of `CHANAKYA_MAIN_TABLE` keys
  are plain ASCII letters (Chanakya reuses codes like `D`, `K`, `S` for common conjuncts) — running
  the table across the whole extracted text would corrupt genuine English content elsewhere in the
  same paper (e.g. multiple-choice option markers "A) B) C) D)"). The text is split on whitespace,
  and only a token where ≥30% of its characters are non-ASCII gets converted; every other token
  (English prose, numerals, the `-- N of M --` page markers) passes through byte-for-byte
  unchanged. The real garbled runs observed so far are 70–100% non-ASCII, well clear of this
  threshold; ordinary English text with an incidental symbol (a degree sign, an em dash) stays
  well under it.
- `containsChanakyaMojibake`: a cheap detection check, logged (not currently alerted on) when a
  `PastPaper` ingestion actually hits this path, so it's visible in logs which papers needed it.

## Consequences

**Makes easier:** `PastPaper cmtyqyy0z0001sahpuyhz0v24`'s Hindi sections are now real, readable
Devanagari rather than corrupted content shipping raw to the quiz-generation AI (`TAPS-4.1`/
`TAPS-4.2`) or, if ever surfaced directly, to a user. Any _other_ Chanakya-rendered PDF that
happens to reuse an identically-generated `ToUnicode` CMap (plausible if produced by the same DTP
pipeline/era) would also convert correctly with no further work.

**Makes harder / known limitations:**

- **This table is derived from one specific PDF's embedded `ToUnicode` CMap, not a universal
  Chanakya decoder.** A different Chanakya-rendered PDF from a different source, even for the same
  exam board, could embed a _differently_-generated (if structurally similar) `ToUnicode` CMap,
  and would not necessarily convert correctly against this exact table. Re-deriving a table per
  new source PDF, the way this ADR describes, is mechanical but not yet automated — filed as a
  follow-up if/when a second real Chanakya-encoded `PastPaper` is sourced (see `TAPS-4.4`).
- **Isolation-tested and confirmed unrelated to `TAPS-4.5`:** removing the raw mojibake from the
  prompt entirely and re-running generation against the real OpenAI API still reproduced the
  identical `finish_reason: length` failure — this conversion does not change `TAPS-4.5`'s
  chunking story.
- A handful of the table's rarer entries (specifically the three-character combinations used for
  the "ऑ"/"औ" vowel family, and three placeholder-swap entries carried over from the reference
  table for very rare special-symbol sequences) are mechanically derived and CMap-verified but
  were not individually hand-confirmed against a live sample the way the two headline strings
  above were, since neither real sample happens to exercise them.
- The 30%-non-ASCII-density token heuristic is a deliberate approximation, not a guarantee: a
  pathological English token that happened to be mostly non-ASCII by coincidence (not observed in
  practice) could be mis-converted. No such case has been found in the one real paper available.

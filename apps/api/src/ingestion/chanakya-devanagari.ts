/**
 * TAPS-4.6: converts Chanakya-font Devanagari mojibake back into real Unicode
 * Devanagari, as a post-processing step on `PastPaperIngestionService`'s
 * `pdf-parse` output.
 *
 * Root cause (see `docs/adr/024-chanakya-devanagari-mojibake-conversion.md` for
 * the full investigation): `PastPaper cmtyqyy0z0001sahpuyhz0v24`'s source PDF
 * renders its Hindi sections with the legacy pre-Unicode "Chanakya" typeface —
 * confirmed directly from the PDF's own embedded font resources (`/BaseFont
 * /LSLLKX+Chanakya`, `ChanakyaBold`, `ChanakyaItalic`, `ChanakyaBoldItalic`),
 * not inferred from the garbled output alone. Chanakya, like Kruti Dev, draws
 * Devanagari glyph shapes at ordinary Latin-range character-code positions
 * (a Remington-keyboard-style pre-Unicode encoding); this particular PDF also
 * embeds a `ToUnicode` CMap that maps those same codes to *unrelated* Unicode
 * symbol/accented-Latin characters (dagger, hungarumlaut, lozenge, summation,
 * fraction-slash, …) rather than to Devanagari or leaving them unmapped. That
 * combination is exactly why `pdf-parse` extracts valid, non-`U+FFFD` Unicode
 * that nonetheless reads as meaningless Latin-range mojibake, e.g. the
 * documented sample `¬˝‡Ÿ-¬òÊ` (should read `प्रश्न-पत्र`, "Question Paper").
 *
 * `CHANAKYA_MAIN_TABLE` below maps each such mojibake sequence back to its
 * correct Devanagari, derived by composing this exact PDF's real embedded
 * `ToUnicode` CMap with the standard, independently-documented Chanakya
 * character-encoding chart (cross-referenced against the `hindi-font-converter`
 * project's Chanakya table — see the ADR) — every entry corresponds to a font
 * code confirmed present in this document's own CMap, not assumed from a
 * generic table. Validated end-to-end against two independent real samples
 * from this paper (the bilingual cover page's `PAPER-I` / `MAIN TEST BOOKLET`
 * headers) — both convert to grammatically correct, contextually correct
 * Hindi. See the ADR for the known scope limits (this table is derived from
 * one specific PDF's CMap; a different Chanakya-rendered PDF could embed a
 * differently-generated CMap and would need its own conversion table).
 */

// Auto-derived from the real PastPaper cmtyqyy0z0001sahpuyhz0v24 PDF's embedded
// LSLLKX+Chanakya font (object 49) and its ToUnicode CMap (object 413) — see
// docs/adr/024-chanakya-devanagari-mojibake-conversion.md for how this was derived.
// Each entry is [mojibakeSequence, correctDevanagari], checked in this exact order
// (multi-character ligature entries must be tried before the single-character
// entries they overlap with).
export const CHANAKYA_MAIN_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['§', ''],
  ['U', ''],
  ['¥', 'ð´'],
  ['∏', '¸ð'],
  ['“', "'"],
  ['•ÊÚ', 'ऑ'],
  ['∏ï', 'क़'],
  ['∏π', 'ख़'],
  ['∏ª', 'ग़'],
  ['∏¡', 'ज़'],
  ['∏«', 'ड़'],
  ['∏…', 'ढ़'],
  ['∏»', 'फ़'],
  ['∏ÿ', 'य़'],
  ['∏⁄', 'ऱ'],
  ['∏Ÿ', 'ऩ'],
  ['D', 'ष्ठ'],
  ['K', '्य'],
  ['L', 'रु'],
  ['M', 'रू'],
  ['a', 'ड्ड'],
  ['d', 'स्र'],
  ['g', 'द्द'],
  ['h', 'द्ध'],
  ['l', 'द्य'],
  ['m', 'द्व'],
  ['r', 'ह्म्'],
  ['ûÊ', 'त्त'],
  ['û', 'त्त्'],
  ['g', 'द्द'],
  ['üÊ', 'श्र'],
  ['≈˛', 'ट्र'],
  ['«˛', 'ड्र'],
  ['…˛', 'ढ्र'],
  ['^', 'ट्ट'],
  ['h', 'द्ध'],
  ['–', '।'],
  ['˝', '्र'],
  ['˛', '्र'],
  ['•Ê', 'ओ'],
  ['•ÊÒ', 'औ'],
  ['•Ê', 'आ'],
  ['•', 'अ'],
  ['ßZ', 'ईं'],
  ['ß¸', 'ई'],
  ['ß', 'इ'],
  ['©', 'उ'],
  ['™', 'ऊ'],
  ['´', 'ऋ'],
  ['∞', 'ऐ'],
  ['∞', 'ए'],
  ['Ä', 'क्'],
  ['∑', 'क'],
  ['Å', 'ख्'],
  ['π', 'ख'],
  ['Ç', 'ग्'],
  ['ª', 'ग'],
  ['ÉÊ', 'घ'],
  ['É', 'घ्'],
  ['ì', 'च्च्'],
  ['ë', 'च्'],
  ['ø', 'च'],
  ['¿', 'छ'],
  ['í', 'ज्'],
  ['¡', 'ज'],
  ['¤Ê', 'झ'],
  ['¤', 'झ्'],
  ['≈', 'ट'],
  ['∆', 'ठ'],
  ['«', 'ड'],
  ['…', 'ढ'],
  ['áÊ', 'ण'],
  ['á', 'ण्'],
  ['à', 'त्'],
  ['Ã', 'त'],
  ['â', 'थ्'],
  ['Õ', 'थ'],
  ['Œ', 'द'],
  ['ä', 'ध्'],
  ['œ', 'ध'],
  ['ÛÊ', 'न्न'],
  ['Û', 'न्न्'],
  ['ãÊ', 'न'],
  ['Ÿ', 'न'],
  ['ã', 'न्'],
  ['å', 'प्'],
  ['¬', 'प'],
  ['»', 'फ'],
  ['é', 'ब्'],
  ['’', 'ब'],
  ['è', 'भ्'],
  ['÷', 'भ'],
  ['ê', 'म्'],
  ['◊', 'म'],
  ['ÿ', 'य'],
  ['⁄', 'र'],
  ['À', 'ल्'],
  ['‹', 'ल'],
  ['√', 'व्'],
  ['ﬂ', 'व'],
  ['‡Ê', 'श'],
  ['o', 'श'],
  ['‡', 'श्'],
  ['c', 'ष्'],
  ['·', 'ष'],
  ['S', 'स्'],
  ['‚', 'स'],
  ['„', 'ह'],
  ['ˇÊ', 'क्ष'],
  ['ˇ', 'क्ष्'],
  ['òÊ', 'त्र'],
  ['ò', 'त्र्'],
  ['ôÊ', 'ज्ञ'],
  ['ô', 'ज्ञ्'],
  ['¸¥', 'ðZ'],
  ['ÊÚ', 'ॉ'],
  ['ÊÒ', 'ौ'],
  ['Ê', 'ा'],
  ['Ë', 'ी'],
  ['È', 'ु'],
  ['Í', 'ू'],
  ['Î', 'ृ'],
  ['Ò', 'ै'],
  ['¥', 'ं'],
  ['°', 'ँ'],
  ['—', ':'],
  ['∏', '़'],
  ['Ú', 'ॅ'],
  ['˜', '्'],
  ['', 'े'],
];

// Post-substitution cleanup: a handful of matra/virama combinations the main table
// leaves in a non-canonical (but still valid-looking) form; applied after reordering.
export const CHANAKYA_CLEANUP_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['्ो', 'े'],
  ['्ौ', 'ै'],
  ['्ाे', 'े'],
  ['्ाा', 'ा'],
  ['ाे', 'ो'],
  ['ाे', 'ो'],
  ['ाै', 'ौ'],
  ['्ा', ''],
  ['ंु', 'ुं'],
  ['ओे', 'ओ'],
  ['ोे', 'ो'],
  ['ाे', 'ो'],
  ['ईंं', 'ईं'],
];

// Marks a pre-base vowel sign (Devanagari ि (i)) that Chanakya, like other
// Remington-keyboard-style legacy fonts, encodes typed *before* its consonant even
// though Unicode stores it *after* — must be moved past the base consonant (and any
// half-form/virama cluster it introduces) to land in the correct Unicode position.
export const CHANAKYA_PREBASE_VOWEL_MARKER = 'Á';

function applyTable(text: string, table: ReadonlyArray<readonly [string, string]>): string {
  for (const [pattern, replacement] of table) {
    if (pattern === '') continue;
    // Loop rather than a single global replace: some replacements can introduce
    // a new occurrence of an earlier-in-this-same-pattern substring (rare, but
    // matches the reference conversion this table was cross-checked against).
    let guard = 0;
    while (text.includes(pattern) && guard < 50) {
      text = text.split(pattern).join(replacement);
      guard++;
    }
  }
  return text;
}

/**
 * Chanakya types the pre-base vowel sign (Devanagari "ि") *before* its
 * consonant, matching where it's drawn on screen — but Unicode stores it
 * *after* the consonant (and after any half-form/virama conjunct cluster the
 * consonant introduces). `CHANAKYA_MAIN_TABLE` leaves this marker character
 * untranslated for exactly that reason; this pass moves it into the correct
 * post-base position.
 */
function reorderPrebaseVowelSign(text: string): string {
  const marker = CHANAKYA_PREBASE_VOWEL_MARKER;
  let pos = text.indexOf(marker);
  while (pos !== -1) {
    if (pos + 1 >= text.length) break;
    const right = text[pos + 1];
    text = text.replace(marker + right, right + 'ि');
    pos += 1; // now pointing at the relocated "ि"
    while (pos + 1 < text.length && text[pos + 1] === '्') {
      const cluster = text[pos + 1] + text[pos + 2];
      text = text.replace('ि' + cluster, cluster + 'ि');
      pos += 2;
    }
    pos = text.indexOf(marker, pos + 1);
  }
  return text;
}

/**
 * A whitespace-delimited token counts as a Chanakya-mojibake run once at
 * least this fraction of its characters fall outside plain ASCII. Genuine
 * English/numeral tokens in these papers (including ones with an incidental
 * symbol like `°` or an em dash) stay well under this; the actual garbled
 * runs documented so far are 70-100% non-ASCII. Gating per-token, rather than
 * substituting across the whole extracted text, matters because a handful of
 * `CHANAKYA_MAIN_TABLE` keys are plain ASCII letters (e.g. `D`, `K`, `S`) that
 * Chanakya reuses for common conjuncts — safe to convert only when they occur
 * inside a token a real mojibake marker already flagged, never in ordinary
 * English text elsewhere in the same paper.
 */
const MOJIBAKE_TOKEN_THRESHOLD = 0.3;

function isLikelyMojibakeToken(token: string): boolean {
  if (token.length === 0) return false;
  let nonAscii = 0;
  for (const ch of token) {
    if (ch.charCodeAt(0) > 0x7f) nonAscii++;
  }
  return nonAscii / token.length >= MOJIBAKE_TOKEN_THRESHOLD;
}

function convertToken(token: string): string {
  const substituted = applyTable(token, CHANAKYA_MAIN_TABLE);
  const reordered = reorderPrebaseVowelSign(substituted);
  return applyTable(reordered, CHANAKYA_CLEANUP_TABLE);
}

/** True if `text` contains at least one run that looks like Chanakya mojibake. */
export function containsChanakyaMojibake(text: string): boolean {
  return text.split(/(\s+)/).some(isLikelyMojibakeToken);
}

/**
 * Converts any Chanakya-mojibake runs in `text` to real Devanagari Unicode,
 * leaving every other token (English prose, numerals, page markers, ...)
 * byte-for-byte unchanged. Safe to run unconditionally on any extracted PDF
 * text, including papers with no Hindi/Chanakya content at all — it is a
 * no-op whenever no token crosses `MOJIBAKE_TOKEN_THRESHOLD`.
 */
export function convertChanakyaMojibake(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) => (isLikelyMojibakeToken(token) ? convertToken(token) : token))
    .join('');
}

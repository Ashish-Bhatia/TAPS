import { containsChanakyaMojibake, convertChanakyaMojibake } from './chanakya-devanagari.js';

/**
 * TAPS-4.6: the known-bad sample is the exact mojibake string documented in
 * `docs/backlog/BACKLOG.md`'s TAPS-4.6 row and confirmed live against the
 * real `PastPaper cmtyqyy0z0001sahpuyhz0v24` (its bilingual cover page's
 * "PAPER-I" header) — see `docs/adr/024-chanakya-devanagari-mojibake-conversion.md`.
 */
describe('convertChanakyaMojibake', () => {
  it('converts the documented known-bad sample to correct Devanagari', () => {
    const mojibake = '¬˝‡Ÿ-¬òÊ';
    expect(convertChanakyaMojibake(mojibake)).toBe('प्रश्न-पत्र');
  });

  it('converts a second real sample from the same paper (bilingual "MAIN TEST BOOKLET" header)', () => {
    const mojibake = '◊ÈÅÿ ¬⁄UËˇÊÊ ¬ÈÁSÃ∑§Ê';
    expect(convertChanakyaMojibake(mojibake)).toBe('मुख्य परीक्षा पुस्तिका');
  });

  it('converts mojibake embedded in a full bilingual line, leaving the English half untouched', () => {
    const line = 'PAPER-I / ¬˝‡Ÿ-¬òÊ-I';
    expect(convertChanakyaMojibake(line)).toBe('PAPER-I / प्रश्न-पत्र-I');
  });

  it('leaves plain English/ASCII text completely unchanged', () => {
    const english = 'MAIN TEST BOOKLET This booklet contains 48 Printed pages.';
    expect(convertChanakyaMojibake(english)).toBe(english);
  });

  it('leaves an English word with an incidental non-ASCII symbol unchanged (below the mojibake density threshold)', () => {
    const text = 'Room temperature was 37°C during the exam.';
    expect(convertChanakyaMojibake(text)).toBe(text);
  });

  it('leaves page-boundary markers untouched', () => {
    const marker = '-- 34 of 48 --';
    expect(convertChanakyaMojibake(marker)).toBe(marker);
  });

  it('is a no-op on text with no mojibake at all', () => {
    const text = 'Ordinary English text with no Hindi content whatsoever.';
    expect(convertChanakyaMojibake(text)).toBe(text);
  });
});

describe('containsChanakyaMojibake', () => {
  it('detects the documented known-bad sample', () => {
    expect(containsChanakyaMojibake('¬˝‡Ÿ-¬òÊ')).toBe(true);
  });

  it('returns false for plain English text', () => {
    expect(containsChanakyaMojibake('MAIN TEST BOOKLET')).toBe(false);
  });

  it('returns false for English text with an incidental symbol', () => {
    expect(containsChanakyaMojibake('37°C')).toBe(false);
  });
});

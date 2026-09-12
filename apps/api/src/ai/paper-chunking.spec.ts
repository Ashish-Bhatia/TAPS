import {
  chunkPastPaperText,
  dedupeQuestions,
  DEFAULT_OVERLAP_PAGES,
  DEFAULT_PAGES_PER_CHUNK,
  splitIntoPages,
} from './paper-chunking.js';

/** Builds `pdf-parse`'s exact default page-joiner format for `count` pages. */
function buildPagedText(count: number, pageText: (num: number) => string): string {
  let text = '';
  for (let i = 1; i <= count; i++) {
    text += `${pageText(i)}\n-- ${i} of ${count} --\n\n`;
  }
  return text;
}

describe('splitIntoPages', () => {
  it('treats text with no page markers as a single page', () => {
    const pages = splitIntoPages('Q1. What is 2+2? Answer: 4');
    expect(pages).toEqual([{ num: 1, total: 1, text: 'Q1. What is 2+2? Answer: 4' }]);
  });

  it('parses every page out of pdf-parse-formatted text, in order', () => {
    const text = buildPagedText(3, (n) => `Page ${n} content`);

    const pages = splitIntoPages(text);

    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.num)).toEqual([1, 2, 3]);
    expect(pages.every((p) => p.total === 3)).toBe(true);
    expect(pages[0].text).toBe('Page 1 content');
    expect(pages[2].text).toBe('Page 3 content');
  });

  it('keeps unexpected trailing content after the last marker rather than dropping it', () => {
    const text = buildPagedText(1, () => 'Page 1 content') + 'stray trailing text';

    const pages = splitIntoPages(text);

    expect(pages).toHaveLength(1);
    expect(pages[0].text).toContain('Page 1 content');
    expect(pages[0].text).toContain('stray trailing text');
  });
});

describe('chunkPastPaperText', () => {
  it('returns the original text completely unchanged as a single chunk when it already fits', () => {
    const text = buildPagedText(5, (n) => `Page ${n} content`);

    const chunks = chunkPastPaperText(text, { pagesPerChunk: DEFAULT_PAGES_PER_CHUNK });

    expect(chunks).toEqual([text]);
  });

  it('is a true no-op (byte-identical single chunk) for text with no page markers at all', () => {
    const text = 'Q1. What is 2+2? Answer: 4';

    const chunks = chunkPastPaperText(text);

    expect(chunks).toEqual([text]);
  });

  it('splits a paper larger than one chunk into multiple overlapping, page-boundary-aware chunks', () => {
    const text = buildPagedText(20, (n) => `Page ${n} content`);

    const chunks = chunkPastPaperText(text, { pagesPerChunk: 8, overlapPages: 1 });

    // pagesPerChunk=8, overlap=1 => step 7: [1-8], [8-15], [15-20]
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toContain('Page 1 content');
    expect(chunks[0]).toContain('Page 8 content');
    expect(chunks[0]).not.toContain('Page 9 content');
    // The overlap page (8) appears whole in both chunk 1 and chunk 2.
    expect(chunks[1]).toContain('Page 8 content');
    expect(chunks[1]).toContain('Page 15 content');
    expect(chunks[2]).toContain('Page 15 content');
    expect(chunks[2]).toContain('Page 20 content');
  });

  it('never splits a single page across two chunks', () => {
    const text = buildPagedText(17, (n) => `Page ${n} content, marker-UNIQUE-${n}-END`);

    const chunks = chunkPastPaperText(text, { pagesPerChunk: 8, overlapPages: 1 });

    for (let n = 1; n <= 17; n++) {
      const marker = `marker-UNIQUE-${n}-END`;
      const chunksContainingIt = chunks.filter((c) => c.includes(marker));
      // Every page appears in at least one chunk (nothing lost), and a page
      // is only ever split across chunks by being duplicated whole into an
      // adjacent chunk (the overlap), never cut in half.
      expect(chunksContainingIt.length).toBeGreaterThanOrEqual(1);
      for (const chunk of chunksContainingIt) {
        // If a page's marker is present, its full page content must be too —
        // proves the page wasn't truncated mid-content in that chunk.
        expect(chunk).toContain(`Page ${n} content, ${marker}`);
      }
    }
  });

  it('defaults match the documented DEFAULT_PAGES_PER_CHUNK/DEFAULT_OVERLAP_PAGES constants', () => {
    const text = buildPagedText(DEFAULT_PAGES_PER_CHUNK + 1, (n) => `Page ${n}`);

    const chunks = chunkPastPaperText(text);

    // One page over the default chunk size must produce at least 2 chunks,
    // proving the exported defaults (not just the {8,1} used above) are what
    // chunkPastPaperText() actually uses when called with no options.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_OVERLAP_PAGES).toBeGreaterThanOrEqual(1);
  });
});

describe('dedupeQuestions', () => {
  function item(question: string, provider: 'ANTHROPIC' | 'OPENAI' = 'ANTHROPIC') {
    return { question: { question }, provider };
  }

  it('removes an exact duplicate produced by two overlapping chunks, keeping the first occurrence', () => {
    const items = [item('What is 2+2?'), item('What is 3+3?'), item('What is 2+2?', 'OPENAI')];

    const result = dedupeQuestions(items);

    expect(result).toHaveLength(2);
    expect(result[0].question.question).toBe('What is 2+2?');
    expect(result[0].provider).toBe('ANTHROPIC'); // first occurrence wins
    expect(result[1].question.question).toBe('What is 3+3?');
  });

  it('treats differing whitespace/case as the same question', () => {
    const items = [item('What   is 2+2?'), item('what is 2+2? ')];

    const result = dedupeQuestions(items);

    expect(result).toHaveLength(1);
  });

  it('keeps genuinely different questions that merely share a lot of text', () => {
    const items = [item('What is 2+2?'), item('What is 2+3?')];

    const result = dedupeQuestions(items);

    expect(result).toHaveLength(2);
  });

  it('is a no-op on a list with no duplicates', () => {
    const items = [item('Q1'), item('Q2'), item('Q3')];

    expect(dedupeQuestions(items)).toHaveLength(3);
  });
});

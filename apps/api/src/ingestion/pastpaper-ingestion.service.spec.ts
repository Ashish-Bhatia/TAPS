import { Test, TestingModule } from '@nestjs/testing';
import { ExtractionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PastPaperIngestionService } from './pastpaper-ingestion.service.js';

/**
 * Builds a minimal, structurally valid single-page PDF containing `text` as
 * its page content, with byte offsets computed rather than hand-counted —
 * real bytes real pdf-parse (not mocked) can actually extract from, so the
 * success-path test below exercises the genuine extraction path rather than
 * a stubbed-out one.
 */
function buildMinimalPdf(text: string): Buffer {
  const objects: string[] = [];
  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objects[2] = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  objects[3] =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n';
  objects[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  const streamContent = `BT /F1 24 Tf 72 712 Td (${text}) Tj ET`;
  objects[5] = `5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [0];
  let cursor = header.length;
  for (let i = 1; i <= 5; i++) {
    offsets[i] = cursor;
    body += objects[i];
    cursor += objects[i].length;
  }

  const xrefOffset = header.length + body.length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, 'latin1');
}

function mockFetchResolvedWith(buffer: Buffer, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 404,
      statusText: ok ? 'OK' : 'Not Found',
      arrayBuffer: () =>
        Promise.resolve(
          buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        ),
    }),
  );
}

describe('PastPaperIngestionService', () => {
  let service: PastPaperIngestionService;
  const prismaMock = {
    pastPaper: {
      update: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PastPaperIngestionService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<PastPaperIngestionService>(PastPaperIngestionService);
  });

  it('extracts real text from a valid PDF and writes extractionStatus DONE', async () => {
    // Allocate a few throwaway Buffers first so `buildMinimalPdf`'s own
    // Buffer.from(string) doesn't land at byte 0 of Node's shared small-
    // buffer pool — this reproduced a real bug in `pdf-parse@1.x` (its
    // vendored 2017 pdf.js build mishandled a Buffer with a nonzero
    // pool byteOffset and threw "bad XRef entry" on byte-identical,
    // well-formed PDF content), which is part of why this story picked
    // the `pdfjs-dist`-based v2 line instead — see
    // docs/adr/010-pdf-text-extraction.md.
    for (let i = 0; i < 5; i++) Buffer.from('x'.repeat(10 + i));
    mockFetchResolvedWith(buildMinimalPdf('Hello TAPS'));
    prismaMock.pastPaper.update.mockResolvedValue({
      id: 'pp-1',
      extractionStatus: ExtractionStatus.DONE,
      extractedText: 'Hello TAPS',
    });

    const result = await service.ingest('pp-1', 'https://example.com/paper.pdf');

    expect(prismaMock.pastPaper.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.pastPaper.update).toHaveBeenCalledWith({
      where: { id: 'pp-1' },
      data: {
        // `expect.stringContaining` is typed `any` by vitest's matcher types.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        extractedText: expect.stringContaining('Hello TAPS'),
        extractionStatus: ExtractionStatus.DONE,
      },
    });
    expect(result.extractionStatus).toBe(ExtractionStatus.DONE);
  });

  it('resolves to FAILED (never throws) when the PDF is corrupt/unparseable', async () => {
    mockFetchResolvedWith(Buffer.from('this is not a pdf file at all, just garbage bytes'));
    prismaMock.pastPaper.update.mockResolvedValue({
      id: 'pp-2',
      extractionStatus: ExtractionStatus.FAILED,
      extractedText: null,
    });

    await expect(service.ingest('pp-2', 'https://example.com/corrupt.pdf')).resolves.toEqual(
      expect.objectContaining({ extractionStatus: ExtractionStatus.FAILED }),
    );

    expect(prismaMock.pastPaper.update).toHaveBeenCalledWith({
      where: { id: 'pp-2' },
      data: { extractedText: null, extractionStatus: ExtractionStatus.FAILED },
    });
  });

  it('resolves to FAILED (never throws) when the PDF is empty', async () => {
    mockFetchResolvedWith(Buffer.alloc(0));
    prismaMock.pastPaper.update.mockResolvedValue({
      id: 'pp-3',
      extractionStatus: ExtractionStatus.FAILED,
      extractedText: null,
    });

    await expect(service.ingest('pp-3', 'https://example.com/empty.pdf')).resolves.toEqual(
      expect.objectContaining({ extractionStatus: ExtractionStatus.FAILED }),
    );

    expect(prismaMock.pastPaper.update).toHaveBeenCalledWith({
      where: { id: 'pp-3' },
      data: { extractedText: null, extractionStatus: ExtractionStatus.FAILED },
    });
  });

  it('resolves to FAILED (never throws) when the download itself fails (404)', async () => {
    mockFetchResolvedWith(Buffer.alloc(0), false);
    prismaMock.pastPaper.update.mockResolvedValue({
      id: 'pp-4',
      extractionStatus: ExtractionStatus.FAILED,
      extractedText: null,
    });

    await expect(service.ingest('pp-4', 'https://example.com/missing.pdf')).resolves.toEqual(
      expect.objectContaining({ extractionStatus: ExtractionStatus.FAILED }),
    );
  });

  it('resolves to FAILED (never throws) when fetch itself rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    prismaMock.pastPaper.update.mockResolvedValue({
      id: 'pp-5',
      extractionStatus: ExtractionStatus.FAILED,
      extractedText: null,
    });

    await expect(service.ingest('pp-5', 'https://example.com/paper.pdf')).resolves.toEqual(
      expect.objectContaining({ extractionStatus: ExtractionStatus.FAILED }),
    );
  });
});

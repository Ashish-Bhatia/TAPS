import { Injectable, Logger } from '@nestjs/common';
import { ExtractionStatus, PastPaper } from '@prisma/client';
import { PDFParse } from 'pdf-parse';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * TAPS-4.0: extracts text from a `PastPaper`'s source PDF so EPIC 4's quiz
 * generation has real content to work from (see `05-ARCHITECTURE.md` §5,
 * `generateQuizFromPaper(pastPaperId)`). Wired to run synchronously when a
 * `PastPaper` is created (`PastPaperService.create`, TAPS-2.3's admin CRUD
 * pattern) — see `docs/adr/010-pdf-text-extraction.md` for the `pdf-parse`
 * choice.
 */
@Injectable()
export class PastPaperIngestionService {
  private readonly logger = new Logger(PastPaperIngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Downloads the PDF at `fileUrl` and writes the extracted text back onto
   * the `PastPaper` row `pastPaperId`: `extractionStatus` becomes `DONE`
   * with `extractedText` set on success, or `FAILED` with `extractedText`
   * left `null` if the download or the extraction itself fails for any
   * reason (unreachable URL, non-PDF content, a corrupt/empty PDF, ...).
   * Deliberately never throws/rejects on an extraction error — a bad source
   * PDF must not fail the `PastPaper` admin-create request it's attached
   * to — so callers can always await this and trust the resolved record's
   * `extractionStatus` reflects what actually happened.
   */
  async ingest(pastPaperId: string, fileUrl: string): Promise<PastPaper> {
    try {
      const extractedText = await this.extractText(fileUrl);
      return await this.prisma.pastPaper.update({
        where: { id: pastPaperId },
        data: { extractedText, extractionStatus: ExtractionStatus.DONE },
      });
    } catch (error) {
      this.logger.warn(
        `Text extraction failed for PastPaper ${pastPaperId} (${fileUrl}): ${(error as Error).message}`,
      );
      return this.prisma.pastPaper.update({
        where: { id: pastPaperId },
        data: { extractedText: null, extractionStatus: ExtractionStatus.FAILED },
      });
    }
  }

  private async extractText(fileUrl: string): Promise<string> {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF (${response.status} ${response.statusText})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText();
      return text;
    } finally {
      await parser.destroy();
    }
  }
}

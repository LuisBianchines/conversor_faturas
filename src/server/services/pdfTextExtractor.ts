// Import from lib directly to avoid pdf-parse/index.js trying to open test/data files on import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface ExtractedPdfText {
  text: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    lines: string[];
  }>;
  hasEnoughText: boolean;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdfText> {
  const data = await pdfParse(buffer);

  const text: string = data.text ?? '';
  const rawPages: string[] = text.split(/\f/).filter((p: string) => p.trim().length > 0);

  const pages = rawPages.map((pageText: string, index: number) => {
    const lines: string[] = pageText
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    return {
      pageNumber: index + 1,
      text: pageText,
      lines,
    };
  });

  return {
    text,
    pages,
    hasEnoughText: text.trim().length >= 200,
  };
}

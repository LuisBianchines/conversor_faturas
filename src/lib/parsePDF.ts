import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { parseBBPDF } from './parsers/parseBBPDF'
import { parseItauPDF } from './parsers/parseItauPDF'
import { parseMercadoPagoPDF } from './parsers/parseMercadoPagoPDF'
import type { OFXParseResult, SupportedBank } from './types'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export async function extractLines(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const allLines: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()

    const byY = new Map<number, TextItem[]>()

    for (const item of textContent.items) {
      if (!('str' in item)) {
        continue
      }

      const textItem = item as TextItem
      const y = Math.round(textItem.transform[5])
      const existingY = [...byY.keys()].find((key) => Math.abs(key - y) <= 2)
      const targetY = existingY ?? y

      if (!byY.has(targetY)) {
        byY.set(targetY, [])
      }

      byY.get(targetY)?.push(textItem)
    }

    const sortedYs = [...byY.keys()].sort((a, b) => b - a)

    for (const y of sortedYs) {
      const items = byY.get(y)
      if (!items) {
        continue
      }

      const line = items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((entry) => entry.str)
        .join(' ')
        .trim()

      if (line) {
        allLines.push(line)
      }
    }
  }

  return allLines
}

export function detectBank(lines: string[]): Exclude<SupportedBank, 'ofx'> | null {
  const fullText = lines.join(' ').toLowerCase()

  if (fullText.includes('itaú') || fullText.includes('itau unibanco')) {
    return 'itau'
  }

  if (fullText.includes('banco do brasil') || fullText.includes('ourocard')) {
    return 'bb'
  }

  if (fullText.includes('mercado pago') || fullText.includes('mercadopago')) {
    return 'mercadopago'
  }

  return null
}

export async function parsePDF(arrayBuffer: ArrayBuffer): Promise<OFXParseResult> {
  const lines = await extractLines(arrayBuffer)
  const bank = detectBank(lines)

  if (bank === 'itau') {
    return parseItauPDF(lines)
  }

  if (bank === 'bb') {
    return parseBBPDF(lines)
  }

  if (bank === 'mercadopago') {
    return parseMercadoPagoPDF(lines)
  }

  throw new Error('Banco não reconhecido. PDFs suportados: Itaú, Banco do Brasil e Mercado Pago.')
}

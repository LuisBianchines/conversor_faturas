import { describe, expect, it, vi } from 'vitest'

const { getDocumentMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: getDocumentMock,
}))

import { detectBank, parsePDF } from './parsePDF'

function mockPdfLines(lines: string[]): void {
  getDocumentMock.mockReturnValueOnce({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getTextContent: () =>
            Promise.resolve({
              items: lines.map((line, index) => ({
                str: line,
                transform: [0, 0, 0, 0, index, 100 - index * 3],
              })),
            }),
        }),
    }),
  })
}

describe('parsePDF', () => {
  it('detecta itau', () => {
    expect(detectBank(['Fatura Itaú Unibanco'])).toBe('itau')
  })

  it('detecta banco do brasil', () => {
    expect(detectBank(['Cartão Ourocard Banco do Brasil'])).toBe('bb')
  })

  it('detecta mercado pago', () => {
    expect(detectBank(['Resumo Mercado Pago'])).toBe('mercadopago')
  })

  it('lança erro para banco não reconhecido', async () => {
    mockPdfLines(['Documento genérico sem banco'])

    await expect(parsePDF(new ArrayBuffer(8))).rejects.toThrow(
      'Banco não reconhecido. PDFs suportados: Itaú, Banco do Brasil e Mercado Pago.',
    )
  })
})

import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../utils/errors'

vi.mock('./ollamaClient', () => ({
  generateJsonWithOllama: vi.fn(),
}))

import { generateJsonWithOllama } from './ollamaClient'
import { extractInvoiceWithAi } from './invoiceAiExtractor'

const mockGenerate = vi.mocked(generateJsonWithOllama)

describe('extractInvoiceWithAi', () => {
  it('retorna ParsedInvoice quando Ollama retorna JSON válido', async () => {
    mockGenerate.mockResolvedValueOnce({
      bank: 'itau',
      cardLastDigits: '1234',
      invoiceDueDate: '2026-06-10',
      invoiceTotal: 150,
      transactions: [
        {
          date: '2026-05-10',
          description: 'Supermercado',
          amount: 150,
          type: 'expense',
          installment: null,
          category: null,
          sourceLine: null,
          confidence: 0.95,
        },
      ],
      warnings: [],
    })

    const result = await extractInvoiceWithAi('texto da fatura')

    expect(result.bank).toBe('itau')
    expect(result.transactions).toHaveLength(1)
    expect(result.extractionMethod).toBe('pdf-ai')
  })

  it('lança AI_VALIDATION_FAILED quando JSON é inválido', async () => {
    mockGenerate.mockResolvedValueOnce({
      bank: 'banco_invalido',
      invoiceDueDate: null,
      invoiceTotal: null,
      transactions: [],
    })

    await expect(extractInvoiceWithAi('texto')).rejects.toThrow(ApiError)
  })

  it('propaga OLLAMA_UNAVAILABLE quando Ollama não responde', async () => {
    mockGenerate.mockRejectedValueOnce(
      new ApiError('OLLAMA_UNAVAILABLE', 'Ollama não está rodando.'),
    )

    await expect(extractInvoiceWithAi('texto')).rejects.toMatchObject({
      code: 'OLLAMA_UNAVAILABLE',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { validateParsedInvoice } from './invoiceValidator'
import type { ParsedInvoice } from '../../shared/invoice.types'

function baseInvoice(overrides?: Partial<ParsedInvoice>): ParsedInvoice {
  return {
    bank: 'itau',
    invoiceDueDate: '2026-06-10',
    invoiceTotal: 100,
    transactions: [],
    warnings: [],
    extractionMethod: 'pdf-ai',
    ...overrides,
  }
}

describe('validateParsedInvoice', () => {
  it('adiciona warning quando não há transações', () => {
    const result = validateParsedInvoice(baseInvoice())
    expect(result.warnings).toContain('Nenhuma transação foi identificada.')
  })

  it('adiciona warning para transação com baixa confiança', () => {
    const invoice = baseInvoice({
      transactions: [
        {
          date: '2026-05-01',
          description: 'Compra suspeita',
          amount: 50,
          type: 'expense',
          confidence: 0.5,
        },
      ],
    })
    const result = validateParsedInvoice(invoice)
    expect(result.warnings.some((w) => w.includes('Compra suspeita'))).toBe(true)
  })

  it('remove transações duplicadas', () => {
    const tx = {
      date: '2026-05-01',
      description: 'Netflix',
      amount: 45.9,
      type: 'expense' as const,
      confidence: 0.95,
    }
    const invoice = baseInvoice({ transactions: [tx, tx] })
    const result = validateParsedInvoice(invoice)
    expect(result.transactions).toHaveLength(1)
  })

  it('normaliza descrição com trim', () => {
    const invoice = baseInvoice({
      transactions: [
        {
          date: '2026-05-01',
          description: '  Padaria  ',
          amount: 10,
          type: 'expense',
          confidence: 0.9,
        },
      ],
    })
    const result = validateParsedInvoice(invoice)
    expect(result.transactions[0].description).toBe('Padaria')
  })

  it('adiciona warning quando soma difere do total da fatura', () => {
    const invoice = baseInvoice({
      invoiceTotal: 200,
      transactions: [
        {
          date: '2026-05-01',
          description: 'Compra',
          amount: 50,
          type: 'expense',
          confidence: 0.9,
        },
      ],
    })
    const result = validateParsedInvoice(invoice)
    expect(result.warnings.some((w) => w.includes('difere do total'))).toBe(true)
  })
})

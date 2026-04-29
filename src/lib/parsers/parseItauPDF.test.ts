import { describe, expect, it } from 'vitest'
import { parseItauPDF } from './parseItauPDF'

describe('parseItauPDF', () => {
  it('extrai transacoes, infere ano e ignora linhas indevidas', () => {
    const lines = [
      'Vencimento: 10/01/2026',
      '15/12 SUPERMERCADO 100,00',
      '16/12 PAGAMENTO FATURA -146,80',
      'saúde ITATIBA',
      'Lançamentos no cartão 899,91',
      'Total desta fatura 753,11',
    ]

    const result = parseItauPDF(lines)

    expect(result.transactions).toEqual([
      { date: '15/12/2025', description: 'SUPERMERCADO', amount: 100 },
      { date: '16/12/2025', description: 'PAGAMENTO FATURA', amount: -146.8 },
    ])
    expect(result.balance).toBe(753.11)
    expect(result.fileName).toBe('fatura_2026-01-10.xlsx')
  })
})

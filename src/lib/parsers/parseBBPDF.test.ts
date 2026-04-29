import { describe, expect, it } from 'vitest'
import { parseBBPDF } from './parseBBPDF'

describe('parseBBPDF', () => {
  it('extrai transacoes BR/CA e mantém pagamentos negativos', () => {
    const lines = [
      'Vencimento 15/04/2026',
      '01/04 MERCADO CENTRAL BR R$ 120,00',
      '02/04 HOTEL TORONTO CA R$ 200,50',
      '03/04 PAGAMENTO FATURA R$ -3.841,22',
      'Bancos',
      'SALDO FATURA ANTERIOR R$ 1.000,00',
      'Total da Fatura R$ 4.161,72',
    ]

    const result = parseBBPDF(lines)

    expect(result.transactions).toEqual([
      { date: '01/04/2026', description: 'MERCADO CENTRAL', amount: 120 },
      { date: '02/04/2026', description: 'HOTEL TORONTO', amount: 200.5 },
      { date: '03/04/2026', description: 'PAGAMENTO FATURA', amount: -3841.22 },
    ])
    expect(result.balance).toBe(4161.72)
  })

  it('encontra vencimento quando label e data estão em linhas separadas (layout de tabela)', () => {
    const lines = [
      'Valor Vencimento Limite único',
      'R$5.221,61 10/04/2026 R$5.160,00',
      '01/04 MERCADO BR R$ 50,00',
      'Total da Fatura R$ 50,00',
    ]

    const result = parseBBPDF(lines)

    expect(result.fileName).toBe('fatura_2026-04-10.xlsx')
    expect(result.transactions[0].date).toBe('01/04/2026')
  })
})

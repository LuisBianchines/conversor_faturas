import { describe, expect, it } from 'vitest'
import { parseMercadoPagoPDF } from './parseMercadoPagoPDF'

describe('parseMercadoPagoPDF', () => {
  it('interpreta sinais por seção e ignora totais/cabeçalhos', () => {
    const lines = [
      'Vence em 25/04/2026',
      'Movimentações na fatura',
      'Data Movimentações Valor em R$',
      '02/04 Pagamento da fatura R$ 500,00',
      '03/04 Devolução de compra R$ 40,00',
      '04/04 Tarifa mensal R$ 12,90',
      'Total R$ 552,90',
      'Cartão Visa ************1234',
      '05/04 Compra mercado Parcela 1 de 2 R$ 117,09',
      'Total a pagar R$ 629,99',
    ]

    const result = parseMercadoPagoPDF(lines)

    expect(result.transactions).toEqual([
      { date: '02/04/2026', description: 'Pagamento da fatura', amount: -500 },
      { date: '03/04/2026', description: 'Devolução de compra', amount: -40 },
      { date: '04/04/2026', description: 'Tarifa mensal', amount: 12.9 },
      { date: '05/04/2026', description: 'Compra mercado Parcela 1 de 2', amount: 117.09 },
    ])
    expect(result.balance).toBe(629.99)
  })

  it('encontra vencimento pelo formato "Vencimento: DD/MM/YYYY" das páginas 2+ do PDF', () => {
    const lines = [
      'Vencimento: 17/04/2026',
      'Movimentações na fatura',
      '13/04 Tarifa de uso do crédito emergencial R$ 14,90',
      'Total a pagar R$ 14,90',
    ]

    const result = parseMercadoPagoPDF(lines)

    expect(result.fileName).toBe('fatura_2026-04-17.xlsx')
  })

  it('encontra vencimento quando "Vence em" e a data estão em linhas separadas (layout p.1)', () => {
    const lines = [
      'Vence em Limite total Saque total',
      '17/04/2026 R$ 17.400,00 R$ 50,00',
      'Movimentações na fatura',
      '13/04 Tarifa de uso do crédito emergencial R$ 14,90',
      'Total a pagar R$ 14,90',
    ]

    const result = parseMercadoPagoPDF(lines)

    expect(result.fileName).toBe('fatura_2026-04-17.xlsx')
  })
})

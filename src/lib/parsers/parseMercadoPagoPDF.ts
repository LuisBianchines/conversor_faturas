import type { OFXParseResult } from '../types'
import type { OFXTransaction } from '../types'
import {
  convertShortDate,
  makeResult,
  parseBalance,
  parseBrazilianAmount,
  parseDueDate,
} from './helpers'

const TRANSACTION_REGEX = /^(\d{2}\/\d{2})\s+(.+?)\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/

export function parseMercadoPagoPDF(lines: string[]): OFXParseResult {
  let dueDate: Date | null = null

  // Estratégia 1: "Vencimento: DD/MM/YYYY" — aparece no cabeçalho das páginas 2+ do MP
  const vencimentoColon = lines.find((l) => /Vencimento:\s*\d{2}\/\d{2}\/\d{4}/i.test(l))
  if (vencimentoColon) {
    dueDate = parseDueDate(vencimentoColon, /Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  }

  // Estratégia 2: "Vence em DD/MM/YYYY" na mesma linha
  if (!dueDate) {
    const sameLine = lines.find((l) => /Vence em\s+\d{2}\/\d{2}\/\d{4}/i.test(l))
    if (sameLine) {
      dueDate = parseDueDate(sameLine, /Vence em\s+(\d{2})\/(\d{2})\/(\d{4})/i)
    }
  }

  // Estratégia 3: "Vence em" em uma linha, data na linha seguinte (layout de tabela p.1)
  if (!dueDate) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/\bVence em\b/i.test(lines[i])) {
        dueDate = parseDueDate(lines[i + 1], /^(\d{2})\/(\d{2})\/(\d{4})/)
        if (dueDate) break
      }
    }
  }

  if (!dueDate) {
    throw new Error('Não foi possível identificar a data de vencimento no PDF do Mercado Pago.')
  }

  const transactions: OFXTransaction[] = []
  let currentSection: 'movimentacoes' | 'cartao' | null = null

  for (const line of lines) {
    if (/Movimentações na fatura/i.test(line)) {
      currentSection = 'movimentacoes'
      continue
    }

    if (/Cartão Visa/i.test(line)) {
      currentSection = 'cartao'
      continue
    }

    if (/^Total\s+R\$/i.test(line) || /^Data\s+Movimentações\s+Valor em R\$/i.test(line)) {
      continue
    }

    const match = line.match(TRANSACTION_REGEX)
    if (!match) {
      continue
    }

    const [, shortDate, description, amountRaw] = match
    const parsed = parseBrazilianAmount(amountRaw)
    if (Number.isNaN(parsed)) {
      continue
    }

    const normalizedDescription = description.toLowerCase()
    const isCreditKeyword =
      normalizedDescription.includes('pagamento') || normalizedDescription.includes('devolução')

    let amount = Math.abs(parsed)
    if (currentSection === 'movimentacoes' && isCreditKeyword) {
      amount = -Math.abs(parsed)
    }

    transactions.push({
      date: convertShortDate(shortDate, dueDate),
      description: description.trim(),
      amount,
    })
  }

  const balance = parseBalance(lines, [
    /Total a pagar\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/i,
    /Total\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/i,
  ])

  return makeResult(transactions, balance, dueDate)
}

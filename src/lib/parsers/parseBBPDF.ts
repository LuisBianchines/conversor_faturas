import type { OFXParseResult } from '../types'
import type { OFXTransaction } from '../types'
import {
  convertShortDate,
  makeResult,
  parseBalance,
  parseBrazilianAmount,
  parseDueDate,
} from './helpers'

const WITH_COUNTRY_REGEX =
  /^(\d{2}\/\d{2})\s+(.+?)\s+(?:BR|CA)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})$/
const WITHOUT_COUNTRY_REGEX =
  /^(\d{2}\/\d{2})\s+(.+?)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})$/

export function parseBBPDF(lines: string[]): OFXParseResult {
  let dueDate: Date | null = null

  // Estratégia 1: "Vencimento DD/MM/YYYY" na mesma linha
  const sameLine = lines.find((l) => /Vencimento\s+\d{2}\/\d{2}\/\d{4}/i.test(l))
  if (sameLine) {
    dueDate = parseDueDate(sameLine, /Vencimento\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  }

  // Estratégia 2: buscar "Vencimento" (capital V) no texto completo concatenado,
  // encontrando o primeiro DD/MM/YYYY que aparece após o label (com até 150 chars de distância).
  // Cobre o layout real do BB onde label e valor ficam em células separadas do mesmo row visual:
  // linha extraída: "Valor Vencimento Limite único"
  // linha seguinte: "R$5.221,61 10/04/2026 R$5.160,00"
  if (!dueDate) {
    const fullText = lines.join(' ')
    const fullMatch = fullText.match(/\bVencimento\b[\s\S]{0,150}?(\d{2})\/(\d{2})\/(\d{4})/)
    if (fullMatch) {
      const [, day, month, year] = fullMatch
      const candidate = new Date(`${year}-${month}-${day}T00:00:00`)
      if (!Number.isNaN(candidate.getTime())) dueDate = candidate
    }
  }

  if (!dueDate) {
    throw new Error('Não foi possível identificar a data de vencimento no PDF do Banco do Brasil.')
  }

  const transactions: OFXTransaction[] = []

  for (const line of lines) {
    if (/^SALDO FATURA ANTERIOR/i.test(line)) {
      continue
    }

    const match = line.match(WITH_COUNTRY_REGEX) ?? line.match(WITHOUT_COUNTRY_REGEX)
    if (!match) {
      continue
    }

    const [, shortDate, description, amountRaw] = match
    const amount = parseBrazilianAmount(amountRaw)
    if (Number.isNaN(amount)) {
      continue
    }

    transactions.push({
      date: convertShortDate(shortDate, dueDate),
      description: description.trim(),
      amount,
    })
  }

  const balance = parseBalance(lines, [/Total da Fatura\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})/i])

  return makeResult(transactions, balance, dueDate)
}

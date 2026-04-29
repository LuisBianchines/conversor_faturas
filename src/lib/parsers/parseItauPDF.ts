import type { OFXParseResult } from '../types'
import type { OFXTransaction } from '../types'
import {
  convertShortDate,
  makeResult,
  parseBalance,
  parseBrazilianAmount,
  parseDueDate,
} from './helpers'

const TRANSACTION_REGEX = /^(\d{2}\/\d{2})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$/

export function parseItauPDF(lines: string[]): OFXParseResult {
  const dueDateLine = lines.find((line) => line.includes('Vencimento:'))
  const dueDate = dueDateLine
    ? parseDueDate(dueDateLine, /Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/)
    : null

  if (!dueDate) {
    throw new Error('Não foi possível identificar a data de vencimento no PDF do Itaú.')
  }

  const transactions: OFXTransaction[] = []

  for (const line of lines) {
    if (/^Lançamentos no cartão\s+/i.test(line) || /^Total dos pagamentos\s+/i.test(line)) {
      continue
    }

    const match = line.match(TRANSACTION_REGEX)
    if (!match) {
      continue
    }

    const [, shortDate, description, amountRaw] = match
    const parsedAmount = parseBrazilianAmount(amountRaw)
    if (Number.isNaN(parsedAmount)) {
      continue
    }

    const amount = amountRaw.startsWith('-') ? parsedAmount : Math.abs(parsedAmount)

    transactions.push({
      date: convertShortDate(shortDate, dueDate),
      description: description.trim(),
      amount,
    })
  }

  const balance = parseBalance(lines, [/Total desta fatura\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})/i])

  return makeResult(transactions, balance, dueDate)
}

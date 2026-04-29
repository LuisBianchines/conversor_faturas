import type { OFXTransaction } from '../types'

const VALUE_REGEX = /-?\d{1,3}(?:\.\d{3})*,\d{2}/

export function parseBrazilianAmount(raw: string): number {
  const normalized = raw.replace(/\./g, '').replace(',', '.').trim()
  return Number.parseFloat(normalized)
}

export function parseDueDate(line: string, regex: RegExp): Date | null {
  const match = line.match(regex)
  if (!match) {
    return null
  }

  const [, day, month, year] = match
  const date = new Date(`${year}-${month}-${day}T00:00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

export function buildFileName(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `fatura_${year}-${month}-${day}.xlsx`
}

export function convertShortDate(date: string, dueDate: Date): string {
  const [dayStr, monthStr] = date.split('/')
  const day = Number.parseInt(dayStr, 10)
  const month = Number.parseInt(monthStr, 10)

  if (!Number.isFinite(day) || !Number.isFinite(month)) {
    return date
  }

  const dueYear = dueDate.getFullYear()
  const dueMonth = dueDate.getMonth() + 1
  const inferredYear = month > dueMonth ? dueYear - 1 : dueYear

  return `${dayStr}/${monthStr}/${inferredYear}`
}

export function extractAmountFromLine(line: string): number | null {
  const match = line.match(VALUE_REGEX)
  if (!match) {
    return null
  }

  const value = parseBrazilianAmount(match[0])
  return Number.isNaN(value) ? null : value
}

export function parseBalance(lines: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    for (const line of lines) {
      const match = line.match(pattern)
      if (!match) {
        continue
      }

      const amount = parseBrazilianAmount(match[1])
      if (!Number.isNaN(amount)) {
        return amount
      }
    }
  }

  return 0
}

export function makeResult(
  transactions: OFXTransaction[],
  balance: number,
  dueDate: Date,
) {
  return {
    transactions,
    balance,
    fileName: buildFileName(dueDate),
  }
}

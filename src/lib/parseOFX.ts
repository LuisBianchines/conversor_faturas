import type { OFXParseResult, OFXTransaction } from './types'

function extractTagValue(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\r\n]+)`, 'i')
  const match = block.match(regex)
  return match ? match[1].trim() : null
}

function formatDateFromOFX(rawDate: string): string {
  const digits = rawDate.slice(0, 8)

  if (!/^\d{8}$/.test(digits)) {
    return ''
  }

  const year = digits.slice(0, 4)
  const month = digits.slice(4, 6)
  const day = digits.slice(6, 8)

  return `${day}/${month}/${year}`
}

function formatDateForFileName(rawDate: string): string {
  const digits = rawDate.slice(0, 8)

  if (!/^\d{8}$/.test(digits)) {
    return new Date().toISOString().slice(0, 10)
  }

  const year = digits.slice(0, 4)
  const month = digits.slice(4, 6)
  const day = digits.slice(6, 8)

  return `${year}-${month}-${day}`
}

export function parseOFX(content: string): OFXParseResult {
  const transactions: OFXTransaction[] = []
  const transactionBlocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []

  transactionBlocks.forEach((block) => {
    const dtPosted = extractTagValue(block, 'DTPOSTED')
    const trnAmt = extractTagValue(block, 'TRNAMT')
    const memo = extractTagValue(block, 'MEMO')

    if (!dtPosted || !trnAmt || !memo) {
      return
    }

    const amount = -Number.parseFloat(trnAmt)
    if (Number.isNaN(amount)) {
      return
    }

    transactions.push({
      date: formatDateFromOFX(dtPosted),
      description: memo,
      amount,
    })
  })

  const rawBalance = extractTagValue(content, 'BALAMT')
  const balance = rawBalance ? Number.parseFloat(rawBalance) : 0

  const rawEndDate = extractTagValue(content, 'DTEND')
  const dateForFileName = rawEndDate
    ? formatDateForFileName(rawEndDate)
    : new Date().toISOString().slice(0, 10)

  return {
    transactions,
    balance: Number.isNaN(balance) ? 0 : balance,
    fileName: `fatura_${dateForFileName}.xlsx`,
  }
}

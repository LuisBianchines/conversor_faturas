import type { ParsedInvoice } from '../shared/invoice.types'

function extractTagValue(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\r\n]+)`, 'i')
  const match = block.match(regex)
  return match ? match[1].trim() : null
}

function formatDateFromOFX(rawDate: string): string | null {
  const digits = rawDate.slice(0, 8)

  if (!/^\d{8}$/.test(digits)) {
    return null
  }

  const year = digits.slice(0, 4)
  const month = digits.slice(4, 6)
  const day = digits.slice(6, 8)

  return `${year}-${month}-${day}`
}

export function parseOFX(content: string): ParsedInvoice {
  const transactions: ParsedInvoice['transactions'] = []
  const transactionBlocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []

  transactionBlocks.forEach((block) => {
    const dtPosted = extractTagValue(block, 'DTPOSTED')
    const trnAmt = extractTagValue(block, 'TRNAMT')
    const memo = extractTagValue(block, 'MEMO')

    if (!dtPosted || !trnAmt || !memo) {
      return
    }

    const rawAmount = Number.parseFloat(trnAmt)
    if (Number.isNaN(rawAmount)) {
      return
    }

    // OFX: negative TRNAMT means a purchase/expense; positive means a credit/payment
    const amount = -rawAmount
    const type = amount > 0 ? ('expense' as const) : ('payment' as const)

    transactions.push({
      date: formatDateFromOFX(dtPosted),
      description: memo,
      amount,
      type,
      confidence: 1,
    })
  })

  const rawBalance = extractTagValue(content, 'BALAMT')
  const balance = rawBalance ? Number.parseFloat(rawBalance) : 0

  const rawEndDate = extractTagValue(content, 'DTEND')
  const invoiceDueDate = rawEndDate ? formatDateFromOFX(rawEndDate) : null

  return {
    bank: 'unknown',
    invoiceDueDate,
    invoiceTotal: Number.isNaN(balance) ? null : balance,
    transactions,
    warnings: [],
    extractionMethod: 'ofx',
  }
}

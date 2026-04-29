import * as XLSX from 'xlsx'
import type { OFXTransaction } from './types'

export function exportToExcel(
  transactions: OFXTransaction[],
  fileName: string,
): void {
  const rows = transactions.map((transaction) => ({
    'Data / Descrição': `${transaction.date} - ${transaction.description}`,
    Valor: Number(transaction.amount.toFixed(2)),
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fatura')
  XLSX.writeFile(workbook, fileName)
}

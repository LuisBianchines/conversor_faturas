import * as XLSX from 'xlsx'
import type { ParsedInvoice } from '../shared/invoice.types'

export function exportInvoiceToExcel(invoice: ParsedInvoice): void {
  const rows = invoice.transactions.map((t) => ({
    Data: t.date ?? '',
    Descrição: t.description,
    Valor: Number(t.amount.toFixed(2)),
    Tipo: t.type,
    Parcela: t.installment ?? '',
    Categoria: t.category ?? '',
    Banco: invoice.bank,
    Confiança: t.confidence,
    Método: invoice.extractionMethod,
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fatura')

  const fileName = `fatura_${invoice.bank}_${invoice.invoiceDueDate ?? new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

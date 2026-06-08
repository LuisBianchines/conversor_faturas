import { exportInvoiceToExcel } from '../lib/exportExcel'
import type { ParsedInvoice } from '../shared/invoice.types'

interface PreviewTableProps {
  invoice: ParsedInvoice
  onReset: () => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

const METHOD_LABELS: Record<ParsedInvoice['extractionMethod'], string> = {
  ofx: 'OFX',
  'pdf-regex': 'PDF (parser)',
  'pdf-ai': 'PDF (IA local)',
  hybrid: 'Híbrido',
}

export default function PreviewTable({ invoice, onReset }: PreviewTableProps) {
  const { transactions, warnings, bank, invoiceDueDate, invoiceTotal, extractionMethod } = invoice

  return (
    <div className="w-full max-w-5xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">Prévia da fatura</h2>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-stone-500">
            {bank !== 'unknown' && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 capitalize">{bank.replace('_', ' ')}</span>
            )}
            {invoiceDueDate && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5">
                Vencimento: {formatDate(invoiceDueDate)}
              </span>
            )}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
              {METHOD_LABELS[extractionMethod]}
            </span>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm font-semibold text-yellow-800">Avisos</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-yellow-700">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-left text-sm text-stone-600">
              <th className="px-3 py-3 font-semibold">Data</th>
              <th className="px-3 py-3 font-semibold">Descrição</th>
              <th className="px-3 py-3 font-semibold">Tipo</th>
              <th className="px-3 py-3 font-semibold">Parcela</th>
              <th className="px-3 py-3 font-semibold text-right">Valor</th>
              {extractionMethod === 'pdf-ai' && (
                <th className="px-3 py-3 font-semibold text-right">Confiança</th>
              )}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, index) => (
              <tr
                key={`${t.date}-${t.description}-${index}`}
                className="border-b border-stone-100"
              >
                <td className="px-3 py-3 text-sm text-stone-600 whitespace-nowrap">
                  {formatDate(t.date)}
                </td>
                <td className="px-3 py-3 text-sm text-stone-800">{t.description}</td>
                <td className="px-3 py-3 text-sm text-stone-500 capitalize">{t.type}</td>
                <td className="px-3 py-3 text-sm text-stone-500">{t.installment ?? '—'}</td>
                <td
                  className={`px-3 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                    t.amount > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(t.amount)}
                </td>
                {extractionMethod === 'pdf-ai' && (
                  <td className="px-3 py-3 text-sm text-right text-stone-500">
                    {Math.round(t.confidence * 100)}%
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoiceTotal !== null && (
        <div className="mt-5 rounded-lg bg-stone-100 p-4 text-right text-base font-semibold text-stone-800">
          Total da fatura: {formatCurrency(invoiceTotal)}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => exportInvoiceToExcel(invoice)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Baixar Excel
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          Importar outro arquivo
        </button>
      </div>
    </div>
  )
}

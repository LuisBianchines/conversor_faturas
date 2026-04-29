import { exportToExcel } from '../lib/exportExcel'
import type { OFXTransaction } from '../lib/types'

interface PreviewTableProps {
  transactions: OFXTransaction[]
  balance: number
  fileName: string
  onReset: () => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default function PreviewTable({
  transactions,
  balance,
  fileName,
  onReset,
}: PreviewTableProps) {
  return (
    <div className="w-full max-w-5xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-stone-900">Prévia da fatura</h2>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-left text-sm text-stone-600">
              <th className="px-3 py-3 font-semibold">Data / Descrição</th>
              <th className="px-3 py-3 font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr key={`${transaction.date}-${transaction.description}-${index}`} className="border-b border-stone-100">
                <td className="px-3 py-3 text-sm text-stone-800">
                  {transaction.date} - {transaction.description}
                </td>
                <td
                  className={`px-3 py-3 text-sm font-semibold ${
                    transaction.amount > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(transaction.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg bg-stone-100 p-4 text-right text-base font-semibold text-stone-800">
        Saldo da fatura: {formatCurrency(balance)}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => exportToExcel(transactions, fileName)}
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

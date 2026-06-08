import { useState } from 'react'
import DropZone from './components/DropZone'
import PreviewTable from './components/PreviewTable'
import type { ParsedInvoice } from './shared/invoice.types'

export default function App() {
  const [invoice, setInvoice] = useState<ParsedInvoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
        <header className="w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-stone-900 sm:text-4xl">
            Conversor de Faturas para Excel
          </h1>
          <p className="mt-2 text-sm text-stone-600 sm:text-base">
            Faça upload da fatura OFX ou PDF, confira a prévia e baixe o arquivo .xlsx.
          </p>
        </header>

        {invoice === null ? (
          <>
            <DropZone
              onInvoiceParsed={(parsed) => {
                setInvoice(parsed)
                setError(null)
              }}
              onError={setError}
            />
            {error ? (
              <p className="w-full max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          <PreviewTable
            invoice={invoice}
            onReset={() => {
              setInvoice(null)
              setError(null)
            }}
          />
        )}
      </div>
    </main>
  )
}

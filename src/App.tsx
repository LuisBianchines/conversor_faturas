import { useState } from 'react'
import DropZone from './components/DropZone'
import PreviewTable from './components/PreviewTable'
import type { OFXTransaction } from './lib/types'

export default function App() {
  const [transactions, setTransactions] = useState<OFXTransaction[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [balance, setBalance] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
        <header className="w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-stone-900 sm:text-4xl">
            Conversor de Faturas OFX para Excel
          </h1>
          <p className="mt-2 text-sm text-stone-600 sm:text-base">
            Faça upload da fatura, confira a prévia e baixe o arquivo .xlsx.
          </p>
        </header>

        {transactions.length === 0 ? (
          <>
            <DropZone
              onFileParsed={(result) => {
                setTransactions(result.transactions)
                setBalance(result.balance)
                setFileName(result.fileName)
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
            transactions={transactions}
            balance={balance}
            fileName={fileName}
            onReset={() => {
              setTransactions([])
              setBalance(0)
              setFileName('')
              setError(null)
            }}
          />
        )}
      </div>
    </main>
  )
}

import { useRef, useState } from 'react'
import { parseOFX } from '../lib/parseOFX'
import type { ParsedInvoice } from '../shared/invoice.types'
import type { ConvertApiResponse } from '../shared/api.types'

interface DropZoneProps {
  onInvoiceParsed: (invoice: ParsedInvoice) => void
  onError: (message: string | null) => void
}

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.ofx') || name.endsWith('.pdf')
}

async function convertPdfWithLocalAI(file: File): Promise<ParsedInvoice> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('useAi', 'true')

  let response: Response

  try {
    response = await fetch('http://localhost:3001/api/convert', {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new Error(
      'Backend local não está rodando. Execute npm run dev e tente novamente.',
    )
  }

  const payload = (await response.json()) as ConvertApiResponse

  if (!payload.success) {
    if (payload.error.code === 'OLLAMA_UNAVAILABLE') {
      throw new Error(
        `Ollama não está respondendo. Verifique se o Ollama está instalado e se o modelo foi baixado.\n\nComando: ollama pull qwen2.5:7b`,
      )
    }
    throw new Error(payload.error.message)
  }

  return payload.data
}

export default function DropZone({ onInvoiceParsed, onError }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const processFile = async (file: File): Promise<void> => {
    if (!isSupportedFile(file)) {
      onError('Formato inválido. Por favor, importe um arquivo .ofx ou .pdf.')
      return
    }

    const isOFX = file.name.toLowerCase().endsWith('.ofx')
    const isPDF = file.name.toLowerCase().endsWith('.pdf')

    setSelectedFileName(file.name)
    onError(null)

    if (isOFX) {
      try {
        const content = await file.text()
        const parsed = parseOFX(content)
        onInvoiceParsed(parsed)
      } catch (error) {
        onError(
          error instanceof Error ? error.message : 'Não foi possível processar o arquivo OFX.',
        )
      }
      return
    }

    if (isPDF) {
      setIsLoading(true)
      try {
        const result = await convertPdfWithLocalAI(file)
        onInvoiceParsed(result)
      } catch (error) {
        onError(
          error instanceof Error ? error.message : 'Não foi possível processar o PDF.',
        )
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void processFile(file)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) void processFile(file)
  }

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isLoading && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !isLoading) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${
          isLoading
            ? 'border-stone-300 bg-stone-50 opacity-70'
            : isDragging
              ? 'border-amber-600 bg-amber-50'
              : 'border-stone-300 bg-stone-50 hover:border-stone-400'
        }`}
      >
        {isLoading ? (
          <>
            <p className="text-lg font-semibold text-stone-800">Processando fatura…</p>
            <p className="mt-2 text-sm text-stone-500">
              A IA local está analisando o PDF. Pode levar alguns segundos.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-stone-800">Importe sua fatura OFX ou PDF</p>
            <p className="mt-2 text-sm text-stone-600">
              Arraste e solte o arquivo aqui ou clique para selecionar.
            </p>
            {selectedFileName ? (
              <p className="mt-4 text-sm font-medium text-stone-700">
                Arquivo: {selectedFileName}
              </p>
            ) : null}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".ofx,.pdf"
        onChange={handleInputChange}
      />
    </div>
  )
}

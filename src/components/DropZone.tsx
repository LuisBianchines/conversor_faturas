import { useEffect, useRef, useState } from 'react'
import { parseOFX } from '../lib/parseOFX'
import type { ParsedInvoice } from '../shared/invoice.types'
import type { ConvertStreamEvent } from '../shared/api.types'

interface DropZoneProps {
  onInvoiceParsed: (invoice: ParsedInvoice) => void
  onError: (message: string | null) => void
}

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.ofx') || name.endsWith('.pdf')
}

async function* readSSE(response: Response): AsyncGenerator<ConvertStreamEvent> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = 'message'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as ConvertStreamEvent['data']
          yield { event: currentEvent, data } as ConvertStreamEvent
          currentEvent = 'message'
        } catch {
          // ignora linha malformada
        }
      }
    }
  }
}

export default function DropZone({ onInvoiceParsed, onError }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [tokenBuffer, setTokenBuffer] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const tokenEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    tokenEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tokenBuffer])

  const resetLog = () => {
    setSteps([])
    setTokenBuffer('')
  }

  const processFile = async (file: File): Promise<void> => {
    if (!isSupportedFile(file)) {
      onError('Formato inválido. Por favor, importe um arquivo .ofx ou .pdf.')
      return
    }

    const isOFX = file.name.toLowerCase().endsWith('.ofx')
    const isPDF = file.name.toLowerCase().endsWith('.pdf')

    setSelectedFileName(file.name)
    onError(null)
    resetLog()

    if (isOFX) {
      try {
        const content = await file.text()
        const parsed = parseOFX(content)
        onInvoiceParsed(parsed)
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Não foi possível processar o arquivo OFX.')
      }
      return
    }

    if (isPDF) {
      setIsLoading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        let response: Response
        try {
          response = await fetch('http://localhost:3001/api/convert/stream', {
            method: 'POST',
            body: formData,
          })
        } catch {
          throw new Error('Backend local não está rodando. Execute npm run dev e tente novamente.')
        }

        for await (const event of readSSE(response)) {
          if (event.event === 'step') {
            const { message } = event.data as { message: string }
            setSteps((prev) => [...prev, message])
          } else if (event.event === 'token') {
            const { text } = event.data as { text: string }
            setTokenBuffer((prev) => prev + text)
          } else if (event.event === 'result') {
            const { invoice } = event.data as { invoice: ParsedInvoice }
            onInvoiceParsed(invoice)
          } else if (event.event === 'error') {
            const { code, message } = event.data as { code: string; message: string }
            if (code === 'OLLAMA_UNAVAILABLE') {
              throw new Error(
                `Ollama não está respondendo. Verifique se o Ollama está instalado e se o modelo foi baixado.\n\nComando: ollama pull qwen2.5:7b`,
              )
            }
            throw new Error(message)
          }
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Não foi possível processar o PDF.')
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
    <div className="w-full max-w-3xl space-y-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
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

      {(steps.length > 0 || tokenBuffer) && (
        <div className="rounded-2xl border border-stone-200 bg-stone-950 p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
            Log da IA
          </p>
          <div className="space-y-1">
            {steps.map((step, i) => (
              <p key={i} className="font-mono text-xs text-amber-400">
                {'>'} {step}
              </p>
            ))}
          </div>
          {tokenBuffer && (
            <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-stone-300">
              {tokenBuffer}
              <div ref={tokenEndRef} />
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

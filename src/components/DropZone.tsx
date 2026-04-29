import { useRef, useState } from 'react'
import { parseOFX } from '../lib/parseOFX'
import { parsePDF } from '../lib/parsePDF'
import type { OFXParseResult } from '../lib/types'

interface DropZoneProps {
  onFileParsed: (result: OFXParseResult) => void
  onError: (message: string | null) => void
}

function isSupportedFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  return fileName.endsWith('.ofx') || fileName.endsWith('.pdf')
}

export default function DropZone({ onFileParsed, onError }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const processFile = (file: File): void => {
    if (!isSupportedFile(file)) {
      onError('Formato inválido. Por favor, importe um arquivo .ofx ou .pdf.')
      return
    }

    const isOFX = file.name.toLowerCase().endsWith('.ofx')
    const reader = new FileReader()

    reader.onload = async () => {
      try {
        if (isOFX) {
          const content = typeof reader.result === 'string' ? reader.result : ''
          const parsed = parseOFX(content)

          setSelectedFileName(file.name)
          onError(null)
          onFileParsed(parsed)
          return
        }

        if (!(reader.result instanceof ArrayBuffer)) {
          throw new Error('Não foi possível ler o arquivo. Tente novamente.')
        }

        const parsed = await parsePDF(reader.result)
        setSelectedFileName(file.name)
        onError(null)
        onFileParsed(parsed)
      } catch (error) {
        onError(
          error instanceof Error ? error.message : 'Não foi possível processar o arquivo. Tente novamente.',
        )
      }
    }

    reader.onerror = () => {
      onError('Não foi possível ler o arquivo. Tente novamente.')
    }

    if (isOFX) {
      reader.readAsText(file)
      return
    }

    reader.readAsArrayBuffer(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${
          isDragging
            ? 'border-amber-600 bg-amber-50'
            : 'border-stone-300 bg-stone-50 hover:border-stone-400'
        }`}
      >
        <p className="text-lg font-semibold text-stone-800">Importe sua fatura OFX ou PDF</p>
        <p className="mt-2 text-sm text-stone-600">
          Arraste e solte o arquivo .ofx ou .pdf aqui ou clique para selecionar.
        </p>
        {selectedFileName ? (
          <p className="mt-4 text-sm font-medium text-stone-700">
            Arquivo selecionado: {selectedFileName}
          </p>
        ) : null}
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

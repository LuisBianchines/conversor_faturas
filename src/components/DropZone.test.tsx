import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { parsePDF } from '../lib/parsePDF'
import DropZone from './DropZone'

vi.mock('../lib/parsePDF', () => ({
  parsePDF: vi.fn(),
}))

class FileReaderMock {
  public result: string | ArrayBuffer | null = null
  public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
  public onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null

  readAsText(): void {
    this.result = `
      <OFX>
        <BANKTRANLIST>
          <DTEND>20260429000000[-3:BRT]
          <STMTTRN>
            <DTPOSTED>20260427000000[-3:BRT]
            <TRNAMT>-10.00
            <MEMO>Teste</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL><BALAMT>-10.00</BALAMT></LEDGERBAL>
      </OFX>
    `

    this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>)
  }

  readAsArrayBuffer(): void {
    this.result = new ArrayBuffer(16)
    this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>)
  }
}

describe('DropZone', () => {
  it('renderiza texto instrucional', () => {
    render(<DropZone onFileParsed={vi.fn()} onError={vi.fn()} />)

    expect(screen.getByText(/Arraste e solte o arquivo/i)).toBeInTheDocument()
  })

  it('exibe erro para extensao invalida', () => {
    const onError = vi.fn()
    render(<DropZone onFileParsed={vi.fn()} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = new File(['conteudo'], 'arquivo.csv', { type: 'text/csv' })

    fireEvent.drop(dropArea, {
      dataTransfer: { files: [file] },
    })

    expect(onError).toHaveBeenCalledWith('Formato inválido. Por favor, importe um arquivo .ofx ou .pdf.')
  })

  it('chama onFileParsed para arquivo ofx valido', async () => {
    vi.stubGlobal('FileReader', FileReaderMock)

    const onFileParsed = vi.fn()
    const onError = vi.fn()

    render(<DropZone onFileParsed={onFileParsed} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = new File(['conteudo'], 'fatura.ofx', { type: 'application/octet-stream' })

    fireEvent.drop(dropArea, {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(onFileParsed).toHaveBeenCalledTimes(1)
    })

    expect(onError).toHaveBeenCalledWith(null)
    vi.unstubAllGlobals()
  })

  it('aceita arquivo pdf e usa parsePDF', async () => {
    vi.stubGlobal('FileReader', FileReaderMock)

    const parsePDFMock = vi.mocked(parsePDF)
    parsePDFMock.mockResolvedValueOnce({
      transactions: [{ date: '01/04/2026', description: 'Compra', amount: 10 }],
      balance: 10,
      fileName: 'fatura_2026-04-30.xlsx',
    })

    const onFileParsed = vi.fn()
    const onError = vi.fn()

    render(<DropZone onFileParsed={onFileParsed} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = new File(['conteudo'], 'fatura.pdf', { type: 'application/pdf' })

    fireEvent.drop(dropArea, {
      dataTransfer: { files: [file] },
    })

    await waitFor(() => {
      expect(parsePDFMock).toHaveBeenCalledTimes(1)
      expect(onFileParsed).toHaveBeenCalledTimes(1)
    })

    expect(onError).toHaveBeenCalledWith(null)
    vi.unstubAllGlobals()
  })
})

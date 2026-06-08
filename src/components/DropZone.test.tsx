import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import DropZone from './DropZone'
import type { ParsedInvoice } from '../shared/invoice.types'

const baseInvoice: ParsedInvoice = {
  bank: 'unknown',
  invoiceDueDate: null,
  invoiceTotal: null,
  transactions: [],
  warnings: [],
  extractionMethod: 'ofx',
}

vi.mock('../lib/parseOFX', () => ({
  parseOFX: vi.fn(() => baseInvoice),
}))

vi.mock('../lib/parsePDF', () => ({
  parsePDF: vi.fn(async () => ({
    ...baseInvoice,
    bank: 'itau',
    extractionMethod: 'pdf-regex',
  })),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch


describe('DropZone', () => {
  const onInvoiceParsed = vi.fn()
  const onError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza texto instrucional', () => {
    render(<DropZone onInvoiceParsed={onInvoiceParsed} onError={onError} />)
    expect(screen.getByText(/Arraste e solte o arquivo/i)).toBeInTheDocument()
  })

  it('exibe erro para extensao invalida', () => {
    render(<DropZone onInvoiceParsed={onInvoiceParsed} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = new File(['content'], 'arquivo.csv', { type: 'text/csv' })

    fireEvent.drop(dropArea, { dataTransfer: { files: [file] } })

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('Formato inválido'),
    )
  })

  it('processa arquivo OFX sem chamar o backend', async () => {
    render(<DropZone onInvoiceParsed={onInvoiceParsed} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = new File(['ofx content'], 'fatura.ofx', { type: 'text/plain' })

    fireEvent.drop(dropArea, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(onInvoiceParsed).toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  it('processa PDF sem IA via parsePDF local', async () => {
    render(<DropZone onInvoiceParsed={onInvoiceParsed} onError={onError} />)

    const dropArea = screen.getByRole('button')
    const file = new File(['pdf content'], 'fatura.pdf', { type: 'application/pdf' })

    fireEvent.drop(dropArea, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(onInvoiceParsed).toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  it('chama /api/convert quando PDF e IA estão ativos', async () => {
    const mockInvoice: ParsedInvoice = {
      ...baseInvoice,
      bank: 'itau',
      invoiceDueDate: '2026-06-10',
      invoiceTotal: 200,
      extractionMethod: 'pdf-ai',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockInvoice }),
    })

    render(<DropZone onInvoiceParsed={onInvoiceParsed} onError={onError} />)

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })

    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/convert',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(onInvoiceParsed).toHaveBeenCalledWith(mockInvoice)
    })
  })

  it('exibe erro amigável quando backend não está rodando', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<DropZone onInvoiceParsed={onInvoiceParsed} onError={onError} />)

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })

    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Backend local não está rodando'),
      )
    })
  })

  it('exibe warnings retornados pela API', async () => {
    const mockInvoice: ParsedInvoice = {
      ...baseInvoice,
      extractionMethod: 'pdf-ai',
      warnings: ['Baixa confiança na transação: Padaria'],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockInvoice }),
    })

    render(<DropZone onInvoiceParsed={onInvoiceParsed} onError={onError} />)

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['pdf'], 'fatura.pdf', { type: 'application/pdf' })

    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(onInvoiceParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          warnings: expect.arrayContaining(['Baixa confiança na transação: Padaria']),
        }),
      )
    })
  })
})

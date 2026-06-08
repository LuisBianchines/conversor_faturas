import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PreviewTable from './PreviewTable'
import * as exportExcel from '../lib/exportExcel'
import type { ParsedInvoice } from '../shared/invoice.types'

const baseInvoice: ParsedInvoice = {
  bank: 'itau',
  invoiceDueDate: '2026-04-29',
  invoiceTotal: 40.6,
  transactions: [
    {
      date: '2026-04-27',
      description: 'Netflix.Com',
      amount: 59.9,
      type: 'expense',
      confidence: 1,
    },
    {
      date: '2026-04-28',
      description: 'Estorno',
      amount: -100.5,
      type: 'payment',
      confidence: 1,
    },
  ],
  warnings: [],
  extractionMethod: 'pdf-regex',
}

describe('PreviewTable', () => {
  it('renderiza transacoes na tabela', () => {
    render(<PreviewTable invoice={baseInvoice} onReset={vi.fn()} />)

    expect(screen.getByText('Netflix.Com')).toBeInTheDocument()
    expect(screen.getByText('Estorno')).toBeInTheDocument()
  })

  it('aplica cor vermelha e verde nos valores', () => {
    render(<PreviewTable invoice={baseInvoice} onReset={vi.fn()} />)

    const gasto = screen.getByText(/59,90/)
    const estorno = screen.getByText(/100,50/)

    expect(gasto.className).toContain('text-red-600')
    expect(estorno.className).toContain('text-green-600')
  })

  it('exibe warnings quando presentes', () => {
    const invoice = { ...baseInvoice, warnings: ['Nenhuma transação foi identificada.'] }
    render(<PreviewTable invoice={invoice} onReset={vi.fn()} />)

    expect(screen.getByText('Nenhuma transação foi identificada.')).toBeInTheDocument()
  })

  it('chama exportInvoiceToExcel ao clicar em baixar', () => {
    const spy = vi
      .spyOn(exportExcel, 'exportInvoiceToExcel')
      .mockImplementation(() => undefined)

    render(<PreviewTable invoice={baseInvoice} onReset={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Baixar Excel' }))

    expect(spy).toHaveBeenCalledWith(baseInvoice)
  })

  it('chama onReset ao importar outro arquivo', () => {
    const onReset = vi.fn()
    render(<PreviewTable invoice={baseInvoice} onReset={onReset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Importar outro arquivo' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('mostra coluna de confiança apenas para pdf-ai', () => {
    const aiInvoice: ParsedInvoice = {
      ...baseInvoice,
      extractionMethod: 'pdf-ai',
    }

    render(<PreviewTable invoice={aiInvoice} onReset={vi.fn()} />)
    expect(screen.getByText('Confiança')).toBeInTheDocument()
  })
})

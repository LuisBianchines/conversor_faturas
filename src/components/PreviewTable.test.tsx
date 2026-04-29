import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PreviewTable from './PreviewTable'
import * as exportExcel from '../lib/exportExcel'

const transactions = [
  { date: '27/04/2026', description: 'Netflix.Com', amount: 59.9 },
  { date: '28/04/2026', description: 'Estorno', amount: -100.5 },
]

describe('PreviewTable', () => {
  it('renderiza transacoes na tabela', () => {
    render(
      <PreviewTable
        transactions={transactions}
        balance={40.6}
        fileName="fatura_2026-04-29.xlsx"
        onReset={vi.fn()}
      />,
    )

    expect(screen.getByText('27/04/2026 - Netflix.Com')).toBeInTheDocument()
    expect(screen.getByText('28/04/2026 - Estorno')).toBeInTheDocument()
  })

  it('aplica cor vermelha e verde nos valores', () => {
    render(
      <PreviewTable
        transactions={transactions}
        balance={40.6}
        fileName="fatura_2026-04-29.xlsx"
        onReset={vi.fn()}
      />,
    )

    const gasto = screen.getByText(/59,90/)
    const estorno = screen.getByText(/100,50/)

    expect(gasto.className).toContain('text-red-600')
    expect(estorno.className).toContain('text-green-600')
  })

  it('chama exportToExcel ao clicar em baixar', () => {
    const spy = vi
      .spyOn(exportExcel, 'exportToExcel')
      .mockImplementation(() => undefined)

    render(
      <PreviewTable
        transactions={transactions}
        balance={40.6}
        fileName="fatura_2026-04-29.xlsx"
        onReset={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Baixar Excel' }))

    expect(spy).toHaveBeenCalledWith(transactions, 'fatura_2026-04-29.xlsx')
  })

  it('chama onReset ao importar outro arquivo', () => {
    const onReset = vi.fn()

    render(
      <PreviewTable
        transactions={transactions}
        balance={40.6}
        fileName="fatura_2026-04-29.xlsx"
        onReset={onReset}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Importar outro arquivo' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})

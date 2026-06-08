import { describe, expect, it } from 'vitest'
import { parseOFX } from './parseOFX'

const sampleOFX = `
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <DTSTART>20260401000000[-3:BRT]
          <DTEND>20260429000000[-3:BRT]
          <STMTTRN>
            <DTPOSTED>20260427000000[-3:BRT]
            <TRNAMT>-59.90
            <MEMO>Netflix.Com
          </STMTTRN>
          <STMTTRN>
            <DTPOSTED>20260428000000[-3:BRT]
            <TRNAMT>100.50
            <MEMO>Estorno
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>-3467.45
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`

describe('parseOFX', () => {
  it('converte datas e valores corretamente', () => {
    const result = parseOFX(sampleOFX)

    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({
      date: '2026-04-27',
      description: 'Netflix.Com',
      amount: 59.9,
      type: 'expense',
    })
    expect(result.transactions[1].amount).toBe(-100.5)
    expect(result.transactions[1].type).toBe('payment')
    expect(result.invoiceTotal).toBe(-3467.45)
    expect(result.invoiceDueDate).toBe('2026-04-29')
    expect(result.extractionMethod).toBe('ofx')
  })

  it('retorna lista vazia quando nao ha STMTTRN', () => {
    const result = parseOFX('<OFX><BANKTRANLIST></BANKTRANLIST></OFX>')

    expect(result.transactions).toEqual([])
  })
})

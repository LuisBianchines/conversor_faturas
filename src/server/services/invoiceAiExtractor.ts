import { z } from 'zod';
import { generateJsonWithOllama } from './ollamaClient.js';
import { ApiError } from '../utils/errors.js';
import type { ParsedInvoice } from '../../shared/invoice.types.js';

export function buildInvoiceExtractionPrompt(text: string): string {
  return `Você é um extrator de transações de fatura de cartão de crédito brasileira.

Receba o texto abaixo extraído de um PDF de fatura bancária e retorne APENAS JSON válido.
Não use markdown. Não explique. Não inclua comentários.

Formato obrigatório:
{
  "bank": "nubank|itau|bb|mercado_pago|unknown",
  "cardLastDigits": "string|null",
  "invoiceDueDate": "YYYY-MM-DD|null",
  "invoiceTotal": number|null,
  "transactions": [
    {
      "date": "YYYY-MM-DD|null",
      "description": "string",
      "amount": number,
      "type": "expense|payment|refund|fee|interest|unknown",
      "installment": "string|null",
      "category": "string|null",
      "sourceLine": "string|null",
      "confidence": number
    }
  ],
  "warnings": ["string"]
}

Regras obrigatórias:
- Gastos/compras devem ser positivos.
- Pagamentos, estornos, créditos e devoluções devem ser negativos.
- Tarifas, juros, IOF e encargos devem ser positivos.
- Não invente transações.
- Ignore cabeçalhos, rodapés, propagandas, limites, mensagens promocionais e totais parciais.
- Preserve descrições de compra da forma mais fiel possível.
- Se uma compra estiver parcelada, preencha installment. Exemplo: "2/10".
- Se o ano da transação não aparecer, inferir pelo vencimento da fatura quando possível.
- Se não tiver certeza, use confidence menor que 0.7.
- Não retorne texto fora do JSON.

Texto extraído:
${text}`;
}

const aiTransactionSchema = z.object({
  date: z.string().nullable(),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(['expense', 'payment', 'refund', 'fee', 'interest', 'unknown']),
  installment: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sourceLine: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

const aiInvoiceSchema = z.object({
  bank: z.enum(['nubank', 'itau', 'bb', 'mercado_pago', 'unknown']),
  cardLastDigits: z.string().nullable().optional(),
  invoiceDueDate: z.string().nullable(),
  invoiceTotal: z.number().nullable(),
  transactions: z.array(aiTransactionSchema),
  warnings: z.array(z.string()).default([]),
});

export async function extractInvoiceWithAi(text: string): Promise<ParsedInvoice> {
  const prompt = buildInvoiceExtractionPrompt(text);
  const raw = await generateJsonWithOllama<unknown>({ prompt });

  const result = aiInvoiceSchema.safeParse(raw);

  if (!result.success) {
    throw new ApiError(
      'AI_VALIDATION_FAILED',
      'A resposta da IA não passou na validação. Tente novamente.',
      result.error.issues,
    );
  }

  const parsed = result.data;

  return {
    bank: parsed.bank,
    cardLastDigits: parsed.cardLastDigits ?? null,
    invoiceDueDate: parsed.invoiceDueDate,
    invoiceTotal: parsed.invoiceTotal,
    transactions: parsed.transactions.map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      installment: t.installment ?? null,
      category: t.category ?? null,
      sourceLine: t.sourceLine ?? null,
      confidence: t.confidence,
    })),
    warnings: parsed.warnings,
    extractionMethod: 'pdf-ai',
  };
}

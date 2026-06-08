import type { ParsedInvoice } from '../../shared/invoice.types.js';

export function validateParsedInvoice(invoice: ParsedInvoice): ParsedInvoice {
  const warnings = [...invoice.warnings];

  if (invoice.transactions.length === 0) {
    warnings.push('Nenhuma transação foi identificada.');
  }

  for (const transaction of invoice.transactions) {
    if (transaction.confidence < 0.7) {
      warnings.push(`Baixa confiança na transação: ${transaction.description}`);
    }
  }

  const unique = new Map<string, ParsedInvoice['transactions'][number]>();

  for (const transaction of invoice.transactions) {
    const key = [
      transaction.date,
      transaction.description.trim().toLowerCase(),
      transaction.amount,
    ].join('|');

    if (!unique.has(key)) {
      unique.set(key, {
        ...transaction,
        description: transaction.description.trim(),
        amount: Number(transaction.amount),
      });
    }
  }

  const transactions = [...unique.values()];

  if (invoice.invoiceTotal !== null && transactions.length > 0) {
    const sum = transactions
      .filter((t) => t.type === 'expense' || t.type === 'fee' || t.type === 'interest')
      .reduce((acc, t) => acc + t.amount, 0);

    const diff = Math.abs(sum - (invoice.invoiceTotal ?? 0));
    if (diff > 1 && invoice.invoiceTotal !== null) {
      warnings.push(
        `Soma das despesas (R$ ${sum.toFixed(2)}) difere do total da fatura (R$ ${invoice.invoiceTotal.toFixed(2)}).`,
      );
    }
  }

  return {
    ...invoice,
    transactions,
    warnings,
  };
}

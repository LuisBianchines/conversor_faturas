export type SupportedBank =
  | 'nubank'
  | 'itau'
  | 'bb'
  | 'mercado_pago'
  | 'unknown';

export type InvoiceTransactionType =
  | 'expense'
  | 'payment'
  | 'refund'
  | 'fee'
  | 'interest'
  | 'unknown';

export interface InvoiceTransaction {
  id?: string;
  date: string | null;
  description: string;
  amount: number;
  type: InvoiceTransactionType;
  installment?: string | null;
  category?: string | null;
  sourceLine?: string | null;
  confidence: number;
}

export interface ParsedInvoice {
  bank: SupportedBank;
  cardLastDigits?: string | null;
  invoiceDueDate: string | null;
  invoiceTotal: number | null;
  transactions: InvoiceTransaction[];
  warnings: string[];
  rawTextPreview?: string;
  extractionMethod: 'ofx' | 'pdf-regex' | 'pdf-ai' | 'hybrid';
}

import type { ParsedInvoice } from './invoice.types.js';

export interface ConvertResponse {
  success: true;
  data: ParsedInvoice;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ConvertApiResponse = ConvertResponse | ApiErrorResponse;

export type ConvertStreamEvent =
  | { event: 'step'; data: { message: string } }
  | { event: 'token'; data: { text: string } }
  | { event: 'result'; data: { invoice: ParsedInvoice } }
  | { event: 'error'; data: { code: string; message: string } };

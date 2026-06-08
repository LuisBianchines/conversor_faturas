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

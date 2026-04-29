export interface OFXTransaction {
  date: string;
  description: string;
  amount: number;
}

export interface OFXParseResult {
  transactions: OFXTransaction[];
  balance: number;
  fileName: string;
}

export type SupportedBank = 'itau' | 'bb' | 'mercadopago' | 'ofx'

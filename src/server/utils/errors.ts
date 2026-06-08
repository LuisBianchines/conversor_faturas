export type ApiErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PDF_TEXT_EXTRACTION_FAILED'
  | 'PDF_HAS_NO_TEXT'
  | 'OLLAMA_UNAVAILABLE'
  | 'OLLAMA_INVALID_JSON'
  | 'AI_VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

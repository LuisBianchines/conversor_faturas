import type { Express, Request, Response } from 'express';
import type multer from 'multer';
import { extractPdfText } from '../services/pdfTextExtractor.js';
import { extractInvoiceWithAi } from '../services/invoiceAiExtractor.js';
import { validateParsedInvoice } from '../validators/invoiceValidator.js';
import { ApiError } from '../utils/errors.js';
import type { ConvertApiResponse } from '../../shared/api.types.js';

type MulterInstance = ReturnType<typeof multer>;

const ALLOWED_EXTENSIONS = new Set(['.pdf']);
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

export function registerConvertRoutes(app: Express, upload: MulterInstance): void {
  app.post(
    '/api/convert',
    upload.single('file'),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const file = req.file;

        if (!file) {
          res.status(400).json({
            success: false,
            error: {
              code: 'UNSUPPORTED_FILE_TYPE',
              message: 'Nenhum arquivo enviado.',
            },
          } satisfies ConvertApiResponse);
          return;
        }

        const ext = getExtension(file.originalname);
        const mime = file.mimetype;

        if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'UNSUPPORTED_FILE_TYPE',
              message: 'Formato inválido. Envie um arquivo .pdf.',
            },
          } satisfies ConvertApiResponse);
          return;
        }

        const useAi = req.body.useAi === 'true' || req.body.useAi === true;

        const extracted = await extractPdfText(file.buffer);

        if (!extracted.hasEnoughText) {
          res.status(422).json({
            success: false,
            error: {
              code: 'PDF_HAS_NO_TEXT',
              message:
                'Não foi possível extrair texto suficiente deste PDF. Ele pode ser uma imagem/scan. OCR local será implementado em uma fase futura.',
            },
          } satisfies ConvertApiResponse);
          return;
        }

        if (!useAi) {
          res.status(400).json({
            success: false,
            error: {
              code: 'UNSUPPORTED_FILE_TYPE',
              message: 'Para processar PDFs via backend, ative a opção "Usar IA local".',
            },
          } satisfies ConvertApiResponse);
          return;
        }

        console.log(
          `[convert] arquivo: ${file.originalname} | tamanho: ${file.size} bytes | método: pdf-ai`,
        );

        const aiResult = await extractInvoiceWithAi(extracted.text);
        const validated = validateParsedInvoice(aiResult);

        console.log(
          `[convert] transações: ${validated.transactions.length} | warnings: ${validated.warnings.length}`,
        );

        res.json({
          success: true,
          data: validated,
        } satisfies ConvertApiResponse);
      } catch (error) {
        if (error instanceof ApiError) {
          res.status(500).json({
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          } satisfies ConvertApiResponse);
          return;
        }

        console.error('[convert] erro interno:', error instanceof Error ? error.message : 'desconhecido');

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Erro interno no servidor. Tente novamente.',
          },
        } satisfies ConvertApiResponse);
      }
    },
  );
}

import type { Express, Request, Response } from 'express';
import type multer from 'multer';
import { extractPdfText } from '../services/pdfTextExtractor.js';
import { extractInvoiceWithAi, extractInvoiceWithAiStream } from '../services/invoiceAiExtractor.js';
import { validateParsedInvoice } from '../validators/invoiceValidator.js';
import { ApiError } from '../utils/errors.js';
import type { ConvertApiResponse, ConvertStreamEvent } from '../../shared/api.types.js';

type MulterInstance = ReturnType<typeof multer>;

const ALLOWED_EXTENSIONS = new Set(['.pdf']);
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

function sendSSE(res: Response, event: ConvertStreamEvent): void {
  res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

export function registerConvertRoutes(app: Express, upload: MulterInstance): void {
  app.post(
    '/api/convert/stream',
    upload.single('file'),
    async (req: Request, res: Response): Promise<void> => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const end = (event: ConvertStreamEvent) => {
        sendSSE(res, event);
        res.end();
      };

      try {
        const file = req.file;

        if (!file) {
          end({ event: 'error', data: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Nenhum arquivo enviado.' } });
          return;
        }

        const ext = getExtension(file.originalname);
        const mime = file.mimetype;

        if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
          end({ event: 'error', data: { code: 'UNSUPPORTED_FILE_TYPE', message: 'Formato inválido. Envie um arquivo .pdf.' } });
          return;
        }

        sendSSE(res, { event: 'step', data: { message: 'Extraindo texto do PDF...' } });
        const extracted = await extractPdfText(file.buffer);

        if (!extracted.hasEnoughText) {
          end({ event: 'error', data: { code: 'PDF_HAS_NO_TEXT', message: 'Não foi possível extrair texto suficiente deste PDF.' } });
          return;
        }

        console.log(`[stream] arquivo: ${file.originalname} | tamanho: ${file.size} bytes`);

        sendSSE(res, { event: 'step', data: { message: 'Enviando para IA local (Ollama)...' } });

        const aiResult = await extractInvoiceWithAiStream(extracted.text, (token) => {
          sendSSE(res, { event: 'token', data: { text: token } });
        });

        sendSSE(res, { event: 'step', data: { message: 'Validando resultado...' } });
        const validated = validateParsedInvoice(aiResult);

        console.log(`[stream] transações: ${validated.transactions.length} | warnings: ${validated.warnings.length}`);

        end({ event: 'result', data: { invoice: validated } });
      } catch (error) {
        if (error instanceof ApiError) {
          end({ event: 'error', data: { code: error.code, message: error.message } });
          return;
        }
        console.error('[stream] erro interno:', error instanceof Error ? error.message : 'desconhecido');
        end({ event: 'error', data: { code: 'INTERNAL_ERROR', message: 'Erro interno no servidor. Tente novamente.' } });
      }
    },
  );

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

# SPEC — Conversor de Faturas com IA Local (Ollama)

## 1. Objetivo

Evoluir o projeto `conversor_faturas` para suportar conversão mais robusta de faturas de cartão, principalmente PDFs, usando uma arquitetura local com:

- frontend React/Vite existente;
- backend local Node.js no mesmo repositório;
- extração determinística de texto de PDF;
- interpretação com IA local via Ollama;
- validação determinística antes da prévia/exportação;
- exportação final em Excel mantendo a experiência atual.

O projeto é um utilitário pessoal. Portanto:

- não separar em dois repositórios;
- não enviar faturas para APIs externas;
- não usar serviços pagos;
- não exigir deploy em nuvem;
- preservar privacidade dos arquivos processados.

---

## 2. Contexto atual do projeto

O projeto atual é um app React + TypeScript + Vite que converte faturas/arquivos financeiros para planilha.

Dependências relevantes já existentes:

- `react`
- `react-dom`
- `vite`
- `typescript`
- `pdfjs-dist`
- `xlsx`
- `vitest`

A implementação atual/planejada para PDF usa:

- `pdfjs-dist` no browser;
- extração de texto linha a linha;
- detecção do banco por palavras-chave;
- parsers específicos por banco com regex;
- retorno no mesmo formato usado pelo fluxo OFX;
- exportação `.xlsx` via SheetJS.

Problema: esse modelo falha com frequência porque PDFs de fatura variam muito em layout, ordenação de texto, quebra de linhas, descrição multi-linha, tabelas posicionais e PDFs escaneados.

---

## 3. Decisão arquitetural

Manter tudo no mesmo repositório, mas adicionar um backend local dentro do próprio projeto.

### Estrutura desejada

```txt
conversor_faturas/
  package.json
  vite.config.ts
  tsconfig.json

  src/
    App.tsx
    main.tsx

    components/
      DropZone.tsx
      PreviewTable.tsx

    lib/
      parseOFX.ts
      exportExcel.ts
      pdf/
        parsePDF.ts
        extractPdfText.ts
        detectBank.ts
        parsers/
          parseItauPDF.ts
          parseBBPDF.ts
          parseMercadoPagoPDF.ts

    shared/
      invoice.types.ts
      api.types.ts

    server/
      index.ts
      routes/
        convert.routes.ts
      services/
        pdfTextExtractor.ts
        ollamaClient.ts
        invoiceAiExtractor.ts
        invoiceNormalizer.ts
      validators/
        invoiceValidator.ts
      utils/
        errors.ts
```

Observação: não precisa mover tudo de uma vez se isso causar muito refactor. Pode adicionar `src/server` e `src/shared` mantendo o frontend atual em `src/components` e `src/lib`.

---

## 4. Como o app deve rodar

O projeto deve continuar sendo usado localmente.

### Comando principal

```bash
npm run dev
```

Esse comando deve subir dois processos:

- frontend Vite: `http://localhost:5173`
- backend local: `http://localhost:3001`

### Scripts desejados no `package.json`

Adicionar/ajustar:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:server\"",
    "dev:web": "vite",
    "dev:server": "tsx src/server/index.ts",
    "server": "tsx src/server/index.ts",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "test": "vitest run"
  }
}
```

### Dependências novas

Instalar:

```bash
npm install express multer cors zod
npm install -D tsx concurrently @types/express @types/multer @types/cors
```

Se a extração de PDF no backend exigir uma lib melhor que `pdfjs-dist`, pode adicionar uma das opções abaixo:

```bash
npm install pdf-parse
```

ou manter `pdfjs-dist` também no backend.

Preferência inicial: reaproveitar `pdfjs-dist` se for simples. Se ficar ruim no Node, usar `pdf-parse` no backend.

---

## 5. Ollama

O Ollama será usado como servidor local de IA.

### Instalação manual fora do projeto

O usuário deve instalar o Ollama no computador e baixar um modelo.

Modelo recomendado inicial:

```bash
ollama pull qwen2.5:7b
```

Alternativas:

```bash
ollama pull llama3.1:8b
ollama pull mistral:7b
```

### Endpoint local

O backend deve chamar:

```txt
http://localhost:11434/api/generate
```

### Configuração por variável de ambiente

Criar `.env.example`:

```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
MAX_UPLOAD_MB=20
```

Não commitar `.env` real.

---

## 6. Fluxo funcional desejado

### Fluxo principal

```txt
Usuário seleciona/arrasta PDF ou OFX
  ↓
Frontend valida extensão
  ↓
Se OFX: pode manter fluxo atual local no browser
  ↓
Se PDF: enviar para backend local /api/convert
  ↓
Backend extrai texto do PDF
  ↓
Backend tenta parser determinístico existente, se aplicável
  ↓
Se parser falhar ou se modo IA estiver habilitado: chama Ollama
  ↓
IA retorna JSON estruturado
  ↓
Backend normaliza e valida dados
  ↓
Frontend exibe prévia
  ↓
Usuário exporta Excel
```

### Modo de conversão

Implementar uma opção simples na interface:

```txt
[ ] Usar IA local para interpretar fatura
```

Comportamento recomendado:

- OFX: manter parser atual.
- PDF sem IA: usar parser atual por banco.
- PDF com IA: backend extrai texto e chama Ollama.
- Futuramente: fallback automático para IA quando parser determinístico falhar.

Para esta implementação, priorizar o modo explícito com checkbox para reduzir risco.

---

## 7. Tipos compartilhados

Criar `src/shared/invoice.types.ts`.

```ts
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
  date: string | null; // YYYY-MM-DD
  description: string;
  amount: number; // gasto positivo; pagamento/estorno negativo
  type: InvoiceTransactionType;
  installment?: string | null;
  category?: string | null;
  sourceLine?: string | null;
  confidence: number; // 0 a 1
}

export interface ParsedInvoice {
  bank: SupportedBank;
  cardLastDigits?: string | null;
  invoiceDueDate: string | null; // YYYY-MM-DD
  invoiceTotal: number | null;
  transactions: InvoiceTransaction[];
  warnings: string[];
  rawTextPreview?: string;
  extractionMethod: 'ofx' | 'pdf-regex' | 'pdf-ai' | 'pdf-ocr';
}
```

Criar `src/shared/api.types.ts`.

```ts
import type { ParsedInvoice } from './invoice.types';

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
```

---

## 8. Backend local

Criar `src/server/index.ts`.

Requisitos:

- Express;
- CORS restrito ao frontend local;
- upload via `multer.memoryStorage()`;
- limite de tamanho configurável;
- endpoint de healthcheck;
- endpoint de conversão.

### Exemplo base

```ts
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { registerConvertRoutes } from './routes/convert.routes';

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 20);

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

registerConvertRoutes(app, upload);

app.listen(PORT, () => {
  console.log(`Backend local rodando em http://localhost:${PORT}`);
});
```

---

## 9. Endpoint `/api/convert`

Criar `src/server/routes/convert.routes.ts`.

### Contrato

Request:

- `multipart/form-data`
- campo `file`
- campo opcional `useAi`: `true|false`

Response sucesso:

```json
{
  "success": true,
  "data": {
    "bank": "itau",
    "invoiceDueDate": "2026-06-10",
    "invoiceTotal": 1234.56,
    "transactions": [],
    "warnings": [],
    "extractionMethod": "pdf-ai"
  }
}
```

Response erro:

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "Formato inválido. Envie um arquivo .pdf ou .ofx."
  }
}
```

### Regras

- Aceitar `.pdf` inicialmente para IA.
- OFX pode continuar sendo processado no frontend; se implementar no backend também, manter compatibilidade.
- Rejeitar qualquer outro formato.
- Não salvar arquivo em disco.
- Não logar conteúdo integral da fatura.
- Retornar warnings quando a extração tiver baixa confiança.

---

## 10. Extração de texto PDF

Criar `src/server/services/pdfTextExtractor.ts`.

Responsabilidade:

- receber `Buffer`;
- extrair texto do PDF;
- retornar texto completo e, se possível, linhas por página;
- detectar se o PDF tem pouco texto extraído.

Interface sugerida:

```ts
export interface ExtractedPdfText {
  text: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    lines: string[];
  }>;
  hasEnoughText: boolean;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdfText> {
  // implementar
}
```

Critério inicial:

```ts
hasEnoughText = text.trim().length >= 200;
```

Se `hasEnoughText` for `false`, retornar erro amigável por enquanto:

```txt
Não foi possível extrair texto suficiente deste PDF. Ele pode ser uma imagem/scan. OCR local será implementado em uma fase futura.
```

Não implementar OCR nesta primeira fase, salvo se for simples e não atrasar o restante.

---

## 11. Cliente Ollama

Criar `src/server/services/ollamaClient.ts`.

### Requisitos

- usar `fetch` nativo do Node 18+;
- timeout com `AbortController`;
- ler `OLLAMA_BASE_URL` e `OLLAMA_MODEL` do env;
- chamar `/api/generate`;
- usar `stream: false`;
- usar `format: 'json'`;
- tratar erro quando Ollama não estiver rodando.

### Exemplo

```ts
export interface OllamaGenerateOptions {
  prompt: string;
  model?: string;
  timeoutMs?: number;
}

export async function generateJsonWithOllama<T>(
  options: OllamaGenerateOptions,
): Promise<T> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = options.model ?? process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
  const timeoutMs = options.timeoutMs ?? 120_000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: options.prompt,
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama respondeu com status ${response.status}`);
    }

    const data = await response.json() as { response?: string };

    if (!data.response) {
      throw new Error('Resposta vazia do Ollama.');
    }

    return JSON.parse(data.response) as T;
  } finally {
    clearTimeout(timeout);
  }
}
```

---

## 12. Prompt da IA

Criar `src/server/services/invoiceAiExtractor.ts`.

A IA deve receber o texto extraído e retornar somente JSON válido.

### Prompt base

```ts
export function buildInvoiceExtractionPrompt(text: string): string {
  return `
Você é um extrator de transações de fatura de cartão de crédito brasileira.

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
${text}
`;
}
```

---

## 13. Normalização e validação com Zod

Criar validação do JSON retornado pela IA.

### Schema sugerido

```ts
import { z } from 'zod';

export const aiTransactionSchema = z.object({
  date: z.string().nullable(),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(['expense', 'payment', 'refund', 'fee', 'interest', 'unknown']),
  installment: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sourceLine: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export const aiInvoiceSchema = z.object({
  bank: z.enum(['nubank', 'itau', 'bb', 'mercado_pago', 'unknown']),
  cardLastDigits: z.string().nullable().optional(),
  invoiceDueDate: z.string().nullable(),
  invoiceTotal: z.number().nullable(),
  transactions: z.array(aiTransactionSchema),
  warnings: z.array(z.string()).default([]),
});
```

Regras adicionais em `invoiceValidator.ts`:

- remover transações duplicadas exatas;
- normalizar descrição com trim;
- garantir `amount` numérico;
- se `confidence < 0.7`, adicionar warning;
- se não houver transações, retornar warning;
- comparar soma aproximada das transações com total da fatura, mas sem bloquear.

### Exemplo

```ts
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

  const unique = new Map<string, typeof invoice.transactions[number]>();

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
      });
    }
  }

  return {
    ...invoice,
    transactions: [...unique.values()],
    warnings,
  };
}
```

---

## 14. Integração no frontend

Atualizar `DropZone` ou o componente responsável pelo upload.

### Requisitos

- aceitar `.ofx` e `.pdf`;
- manter fluxo atual para OFX;
- quando arquivo for PDF e `useAi` estiver ativo, enviar para backend;
- exibir loading durante conversão;
- exibir erro amigável se backend local estiver desligado;
- exibir warnings retornados pela API.

### Chamada sugerida

```ts
async function convertPdfWithLocalAI(file: File): Promise<ParsedInvoice> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('useAi', 'true');

  const response = await fetch('http://localhost:3001/api/convert', {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json() as ConvertApiResponse;

  if (!payload.success) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}
```

### Erro amigável para Ollama/backend desligado

Mensagens sugeridas:

```txt
Backend local não está rodando. Execute npm run dev e tente novamente.
```

```txt
Ollama não está respondendo. Verifique se o Ollama está instalado e se o modelo qwen2.5:7b foi baixado.
```

---

## 15. Compatibilidade com exportação Excel atual

A exportação atual provavelmente espera o formato `OFXParseResult`. Não quebrar de imediato.

Criar adaptador:

```ts
export function parsedInvoiceToLegacyResult(invoice: ParsedInvoice): OFXParseResult {
  return {
    transactions: invoice.transactions.map((transaction) => ({
      date: transaction.date ?? '',
      description: transaction.description,
      amount: transaction.amount,
    })),
    balance: invoice.invoiceTotal ?? invoice.transactions.reduce(
      (sum, item) => sum + item.amount,
      0,
    ),
    date: invoice.invoiceDueDate ?? new Date().toISOString().slice(0, 10),
    fileName: `fatura_${invoice.invoiceDueDate ?? new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}
```

Ajustar conforme os tipos reais existentes no projeto.

---

## 16. Segurança e privacidade

Regras obrigatórias:

- Não enviar PDFs para APIs externas.
- Não persistir upload em disco.
- Não salvar PDF em `localStorage`/`sessionStorage`.
- Não logar texto completo da fatura no console por padrão.
- Permitir modo debug apenas se explicitamente ativado por env.
- CORS apenas para `http://localhost:5173`.
- Limitar upload por tamanho.
- Aceitar apenas extensões e MIME types esperados.

### Validação de arquivo

Aceitar:

- `.pdf` com `application/pdf`;
- `.ofx` se for processado no backend futuramente.

Rejeitar:

- `.exe`, `.zip`, `.html`, `.js`, imagens, etc.

---

## 17. Tratamento de erros

Criar códigos padronizados:

```ts
export type ApiErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PDF_TEXT_EXTRACTION_FAILED'
  | 'PDF_HAS_NO_TEXT'
  | 'OLLAMA_UNAVAILABLE'
  | 'OLLAMA_INVALID_JSON'
  | 'AI_VALIDATION_FAILED'
  | 'INTERNAL_ERROR';
```

Mensagens devem ser simples e úteis para usuário final.

---

## 18. Testes

Adicionar testes unitários para:

### Backend

- validação de extensão;
- `invoiceValidator`;
- schema Zod da resposta da IA;
- normalização de transações duplicadas;
- tratamento de JSON inválido do Ollama.

### Frontend

- upload PDF com IA habilitada chama `/api/convert`;
- erro do backend aparece na tela;
- warnings aparecem na tela;
- OFX continua usando fluxo atual.

Não precisa testar Ollama real. Mockar `ollamaClient`.

---

## 19. Critérios de aceite

A implementação será considerada pronta quando:

1. `npm run dev` subir frontend e backend local juntos.
2. PDF puder ser enviado para `/api/convert`.
3. Backend extrair texto do PDF.
4. Backend chamar Ollama local quando `useAi=true`.
5. Resposta da IA for validada com Zod.
6. Frontend exibir transações extraídas em tabela.
7. Exportação Excel continuar funcionando.
8. OFX não quebrar.
9. Nenhum arquivo de fatura for salvo em disco.
10. Erros de backend/Ollama forem amigáveis.
11. `npm run typecheck` passar.
12. `npm run test` passar.

---

## 20. Fases recomendadas de implementação

### Fase 1 — Infra local

- adicionar Express, Multer, CORS, Zod, TSX, Concurrently;
- criar `src/server/index.ts`;
- criar `/health`;
- ajustar scripts.

### Fase 2 — Upload PDF

- criar `/api/convert`;
- receber arquivo em memória;
- validar extensão/tamanho;
- extrair texto do PDF;
- retornar texto parcial em modo temporário para teste.

### Fase 3 — Ollama

- criar `ollamaClient`;
- criar prompt;
- chamar modelo local;
- validar JSON com Zod.

### Fase 4 — Integração frontend

- adicionar checkbox “Usar IA local”;
- enviar PDF para backend;
- adaptar resposta para tabela existente;
- mostrar warnings.

### Fase 5 — Hardening

- melhorar erros;
- adicionar testes;
- remover logs sensíveis;
- documentar setup no README.

---

## 21. README — instruções a adicionar

Adicionar seção ao README:

```md
## Conversão com IA local

Este projeto pode usar IA local via Ollama para interpretar faturas PDF.

### Pré-requisitos

1. Instale o Ollama.
2. Baixe o modelo:

\```bash
ollama pull qwen2.5:7b
\```

3. Rode o projeto:

\```bash
npm install
npm run dev
\```

Frontend: http://localhost:5173  
Backend local: http://localhost:3001

Nenhuma fatura é enviada para APIs externas. O processamento acontece localmente.
```

---

## 22. Observações importantes para o Claude Code

- Não quebrar o fluxo OFX existente.
- Não apagar parsers PDF existentes; manter como caminho determinístico.
- Não criar outro repositório.
- Não transformar o projeto em app cloud/serverless.
- Não adicionar dependências pagas.
- Não commitar `.env`.
- Priorizar tipagem forte, sem `any` desnecessário.
- Usar erros claros.
- Manter código simples: é um utilitário pessoal, não SaaS enterprise.


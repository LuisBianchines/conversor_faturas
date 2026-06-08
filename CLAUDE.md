# CLAUDE.md

## Contexto do projeto

Este projeto é um utilitário pessoal para converter faturas de cartão de crédito em dados estruturados e planilhas.

Objetivo principal:

- Importar arquivos de fatura, principalmente PDF.
- Extrair transações, vencimento, banco, total da fatura e metadados.
- Usar parsers determinísticos quando possível.
- Usar IA local via Ollama como fallback ou modo avançado.
- Exibir prévia para conferência antes da exportação.
- Exportar para Excel.
- Manter tudo no mesmo repositório.

Este projeto NÃO deve ser tratado como SaaS, produto multiusuário ou sistema em produção pública.

---

## Princípios obrigatórios

1. **Privacidade primeiro**
   - Nunca enviar faturas, textos extraídos ou dados financeiros para APIs externas.
   - A única IA permitida é local, via Ollama em `localhost`.
   - Não adicionar OpenAI, Anthropic, Gemini, AWS Bedrock ou qualquer API remota para processar faturas.
   - Não persistir PDF original em disco sem necessidade.
   - Não gravar conteúdo completo de fatura em logs por padrão.

2. **Tudo local**
   - Frontend local com Vite.
   - Backend local no mesmo repositório.
   - Ollama local em `http://localhost:11434`.
   - Não criar deploy cloud, Docker obrigatório, banco remoto ou autenticação complexa sem solicitação explícita.

3. **Não quebrar o fluxo existente**
   - Manter compatibilidade com o conversor OFX atual.
   - Manter exportação Excel existente quando possível.
   - Não remover parsers determinísticos de PDF sem necessidade.
   - Implementar IA como modo adicional, fallback ou pipeline híbrido.

4. **Validação acima da IA**
   - A IA nunca deve ser considerada fonte final sem validação.
   - Todo JSON retornado pelo modelo deve passar por schema validation.
   - Toda transação deve aparecer em uma prévia editável/conferível antes do Excel.
   - Valores, datas e totais devem ser checados por regras determinísticas.

---

## Stack esperada

Frontend:

- React
- TypeScript
- Vite
- TailwindCSS se já estiver configurado
- SheetJS/xlsx para exportação

Backend local:

- Node.js
- TypeScript
- Express ou Fastify
- Multer para upload em memória
- Zod para validação
- pdfjs-dist ou biblioteca equivalente para extração textual
- Cliente HTTP simples para Ollama

IA local:

- Ollama
- Modelo inicial recomendado: `qwen2.5:7b`
- Alternativas: `llama3.1:8b`, `mistral:7b`, `gemma2:9b`

---

## Estrutura recomendada

Manter tudo em um único repositório.

Estrutura sugerida:

```txt
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
      extractTextFromPdf.ts
      detectBank.ts
      parsers/
        parseItauPDF.ts
        parseBBPDF.ts
        parseMercadoPagoPDF.ts

    ai/
      invoicePrompt.ts
      normalizeAiInvoice.ts

  server/
    index.ts
    routes/
      convert.routes.ts
    services/
      pdfExtractor.service.ts
      ollamaClient.service.ts
      invoiceAiExtractor.service.ts
      hybridInvoiceParser.service.ts
    validators/
      invoiceSchema.ts
      invoiceValidator.ts

  shared/
    types/
      invoice.types.ts
```

Não criar outro repositório.

---

## Scripts esperados

Preferir um único `package.json`.

Scripts recomendados:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:server\"",
    "dev:web": "vite",
    "dev:server": "tsx src/server/index.ts",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "test": "vitest run",
    "lint": "eslint ."
  }
}
```

Adicionar dependências somente quando necessário.

Dependências prováveis:

```bash
npm install express multer cors zod
npm install -D tsx concurrently @types/express @types/multer @types/cors
```

---

## Contrato de dados principal

Usar um modelo de domínio neutro, não acoplado ao OFX.

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
  extractionMethod: 'ofx' | 'pdf-regex' | 'pdf-ai' | 'hybrid';
}
```

Regras de sinal:

- Gastos/compras: valor positivo.
- Pagamentos, estornos e devoluções: valor negativo.
- Tarifas, juros e IOF: normalmente positivos, salvo indicação contrária.

---

## Pipeline recomendado

Implementar como pipeline híbrido:

```txt
Arquivo
  ↓
Validação de extensão/tamanho
  ↓
Extração de texto
  ↓
Parser determinístico por banco
  ↓
Validação de confiança
  ↓
Se falhar ou baixa confiança: IA local via Ollama
  ↓
Schema validation
  ↓
Validação de totais/datas/duplicidades
  ↓
Prévia
  ↓
Exportação Excel
```

Critérios para acionar IA:

- Banco desconhecido.
- Menos de N transações extraídas.
- Total da fatura não encontrado.
- Vencimento não encontrado.
- Soma das transações incompatível com total com diferença relevante.
- Usuário selecionou explicitamente “usar IA local”.

---

## Endpoint local esperado

Criar endpoint local:

```txt
POST /api/convert
Content-Type: multipart/form-data
field: file
```

Resposta esperada:

```ts
{
  success: true,
  data: ParsedInvoice
}
```

Erro esperado:

```ts
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: unknown
  }
}
```

Não retornar stack trace para o frontend.

---

## Regras para upload

- Usar `multer.memoryStorage()`.
- Limitar tamanho do arquivo, por exemplo 20 MB.
- Aceitar inicialmente `.pdf` e `.ofx`.
- Rejeitar qualquer outro tipo.
- Validar extensão e MIME type quando possível.
- Não salvar upload em disco por padrão.

Exemplo de limite:

```ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});
```

---

## Ollama

O backend deve chamar apenas:

```txt
http://localhost:11434/api/generate
```

ou endpoint equivalente local do Ollama.

Não hardcodar modelo em vários lugares. Usar constante/config:

```ts
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
```

A resposta da IA deve ser pedida em JSON.

Regras do prompt:

- Pedir apenas JSON válido.
- Proibir invenção de transações.
- Instruir a usar `confidence` baixo quando houver dúvida.
- Instruir a ignorar cabeçalhos, propagandas, rodapés, totais parciais.
- Explicar regra de sinal.
- Informar o schema esperado.

Nunca colocar chaves de API, pois Ollama local não usa chave.

---

## Validação com Zod

Todo retorno da IA deve passar por Zod antes de ser usado.

Exemplo conceitual:

```ts
const ParsedInvoiceSchema = z.object({
  bank: z.enum(['nubank', 'itau', 'bb', 'mercado_pago', 'unknown']),
  invoiceDueDate: z.string().nullable(),
  invoiceTotal: z.number().nullable(),
  transactions: z.array(TransactionSchema),
  warnings: z.array(z.string()),
  extractionMethod: z.enum(['ofx', 'pdf-regex', 'pdf-ai', 'hybrid']),
});
```

Se a IA retornar JSON inválido:

- Tentar uma correção controlada uma única vez.
- Se ainda falhar, retornar erro amigável.
- Não fazer loops infinitos de retry.

---

## Tratamento de erros

Usar erros previsíveis e mensagens claras:

- `INVALID_FILE_TYPE`
- `FILE_TOO_LARGE`
- `PDF_TEXT_EXTRACTION_FAILED`
- `BANK_NOT_RECOGNIZED`
- `OLLAMA_UNAVAILABLE`
- `AI_INVALID_JSON`
- `VALIDATION_FAILED`
- `NO_TRANSACTIONS_FOUND`

Exemplo de mensagem para Ollama indisponível:

```txt
Ollama não está rodando. Inicie com: ollama serve
```

---

## Logs

Logs permitidos:

- nome do arquivo
- tamanho do arquivo
- método usado
- quantidade de páginas
- quantidade de transações extraídas
- warnings
- tempo de processamento

Logs proibidos por padrão:

- número completo de cartão
- CPF
- texto completo da fatura
- lista completa de transações com descrições sensíveis
- PDF em base64

Para debug, se for necessário salvar texto extraído, criar modo explícito:

```txt
DEBUG_EXTRACTION=true
```

Mesmo nesse modo, preferir salvar em pasta ignorada pelo Git.

---

## Git ignore

Garantir que arquivos sensíveis não sejam commitados.

Adicionar/confirmar no `.gitignore`:

```gitignore
uploads/
tmp/
debug/
debug-output/
*.pdf
*.ofx
*.xlsx
.env
.env.local
```

Não versionar faturas reais.

---

## Testes obrigatórios

Criar testes unitários para:

- parser OFX existente
- detecção de banco
- normalização de valores BRL
- validação de schema
- validador de fatura
- cliente Ollama com mock
- endpoint `/api/convert` com arquivo inválido
- endpoint `/api/convert` sem arquivo

Criar fixtures anonimizadas:

```txt
tests/fixtures/
  itau.sample.txt
  bb.sample.txt
  mercado-pago.sample.txt
  unknown.sample.txt
```

Não adicionar PDFs reais com dados pessoais.

---

## TypeScript

Regras:

- Não usar `any`.
- Preferir `unknown` + validação.
- Tipar responses do backend.
- Compartilhar tipos entre frontend e backend via `src/shared`.
- Não duplicar interfaces com nomes diferentes para o mesmo domínio.
- Evitar lógica financeira espalhada por componentes React.

---

## Frontend

O frontend deve:

- Permitir upload/drag-and-drop.
- Mostrar status do processamento.
- Mostrar método usado: OFX, regex, IA local ou híbrido.
- Mostrar warnings.
- Mostrar confiança por transação, se disponível.
- Permitir conferência antes da exportação.
- Não exportar automaticamente sem prévia.
- Exibir erro claro se backend local ou Ollama estiver indisponível.

Não colocar lógica pesada de IA no frontend.

---

## Excel

A exportação deve ser baseada no modelo `ParsedInvoice`.

Colunas recomendadas:

- Data
- Descrição
- Valor
- Tipo
- Parcela
- Categoria
- Banco
- Confiança
- Método de extração

Manter regra de sinal:

- despesas positivas
- pagamentos/estornos/devoluções negativos

---

## Segurança

Apesar de ser projeto pessoal, tratar dados financeiros com cuidado.

Checklist:

- Não salvar faturas reais no Git.
- Não logar dados sensíveis.
- Não enviar dados para APIs externas.
- Não usar `eval`.
- Não renderizar texto extraído com `dangerouslySetInnerHTML`.
- Limitar tamanho de upload.
- Sanitizar nomes de arquivos.
- Usar CORS restrito a `localhost` no backend.

CORS recomendado:

```ts
app.use(cors({
  origin: ['http://localhost:5173'],
}));
```

---

## Critérios de aceite

A implementação será considerada correta quando:

1. O projeto continuar rodando com um único repositório.
2. `npm run dev` subir frontend e backend local.
3. O fluxo OFX existente continuar funcionando.
4. PDFs ainda puderem usar parser determinístico.
5. Quando configurado, o backend conseguir chamar Ollama local.
6. A IA retornar dados no contrato `ParsedInvoice`.
7. JSON da IA for validado com Zod.
8. O frontend mostrar prévia antes da exportação.
9. Excel for gerado a partir dos dados normalizados.
10. Nenhum dado sensível for enviado para fora do computador.

---

## O que NÃO fazer

- Não dividir em dois repositórios.
- Não criar microserviços.
- Não adicionar autenticação complexa.
- Não usar banco de dados remoto.
- Não usar API externa de IA.
- Não adicionar Open Finance agora.
- Não remover o conversor OFX.
- Não versionar faturas reais.
- Não confiar cegamente na IA.
- Não transformar o projeto em SaaS.

---

## Prioridade de implementação

Ordem sugerida:

1. Organizar tipos compartilhados.
2. Criar backend local mínimo.
3. Criar endpoint `/api/convert`.
4. Integrar upload do frontend com backend.
5. Migrar/encapsular extração PDF.
6. Criar cliente Ollama.
7. Criar prompt e schema Zod.
8. Implementar pipeline híbrido.
9. Exibir warnings/confiança no frontend.
10. Ajustar exportação Excel.
11. Criar testes.
12. Melhorar UX e mensagens de erro.

---

## Observação final para o Claude Code

Antes de alterar arquivos, analisar a estrutura atual do projeto e preservar o máximo possível do fluxo existente.

Implementar em passos pequenos, com commits lógicos se possível.

Preferir código simples, explícito e testável ao invés de abstrações excessivas.

Este é um utilitário pessoal: simplicidade, privacidade e confiabilidade são mais importantes do que arquitetura enterprise.

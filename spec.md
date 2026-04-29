# Adição de Suporte a PDF — Itaú, Banco do Brasil e Mercado Pago

🎯 **Objetivo**  
Adicionar suporte à importação de faturas em formato `.pdf` ao conversor já existente (que hoje suporta apenas `.ofx`). O sistema deve detectar automaticamente, ao arrastar e soltar o arquivo, se é OFX ou PDF e, sendo PDF, qual banco emitiu — roteando para o parser específico sem necessidade de seleção manual pelo usuário. O resultado final segue o mesmo fluxo já existente: prévia em tabela e download em Excel.

---

## 📘 Contexto  
O projeto já possui suporte completo a `.ofx` (Nubank) com a seguinte estrutura funcional:
- `src/lib/types.ts` — interfaces `OFXTransaction` e `OFXParseResult`
- `src/lib/parseOFX.ts` — parser de string OFX
- `src/lib/exportExcel.ts` — geração de `.xlsx` com SheetJS
- `src/components/DropZone.tsx` — drag-and-drop, validação `.ofx`
- `src/components/PreviewTable.tsx` — tabela de prévia, saldo, botões
- `src/App.tsx` — orquestração com `useState` local

A **convenção de sinal já vigente** no projeto é:
- Gastos/compras → valor **positivo** (exibido em vermelho)
- Pagamentos/estornos/devoluções → valor **negativo** (exibido em verde)

Esta spec cobre exclusivamente a adição de suporte a PDF. Não alterar nada no fluxo OFX existente.

---

## 🧩 Requisitos Funcionais  
- A `DropZone` deve passar a aceitar arquivos `.ofx` e `.pdf` simultaneamente no mesmo seletor.
- Arquivos com outras extensões continuam exibindo mensagem de erro: `"Formato inválido. Por favor, importe um arquivo .ofx ou .pdf."`.
- Para arquivos `.pdf`, o sistema detecta automaticamente o banco pelo conteúdo do texto extraído, sem input do usuário.
- Bancos suportados: **Itaú**, **Banco do Brasil** e **Mercado Pago**.
- Se o PDF não for reconhecido como nenhum dos três bancos, exibir: `"Banco não reconhecido. PDFs suportados: Itaú, Banco do Brasil e Mercado Pago."`.
- O resultado do parse de PDF alimenta os mesmos componentes `PreviewTable` e `exportToExcel` já existentes, sem alteração nesses componentes.
- O nome do arquivo gerado segue o mesmo padrão: `fatura_YYYY-MM-DD.xlsx` usando a data de vencimento extraída do PDF.
- O saldo exibido no rodapé usa o total da fatura extraído do PDF.

---

## 🧩 Requisitos Técnicos  
- **React 19 + TypeScript + Vite** (já instalado)
- **pdfjs-dist** — instalar via `npm install pdfjs-dist` para extração de texto de PDF no browser
- **xlsx (SheetJS)** — já instalado
- **TailwindCSS** — já instalado
- Sem backend. Extração de texto via `FileReader` (ArrayBuffer) + `pdfjs-dist` no browser.
- O worker do pdfjs deve ser configurado via `import.meta.url` no Vite para evitar necessidade de configuração adicional.
- TypeScript estrito: sem `any`. Usar tipos do pdfjs como `TextItem` de `pdfjs-dist/types/src/display/api`.

---

## 🔧 Detalhes de Implementação  

### 1. Componentes alterados  
- `components/DropZone.tsx` — aceitar `.pdf` além de `.ofx`; rotear para `parseOFX` ou `parsePDF` conforme extensão

### 2. Novos utilitários  
- `lib/parsePDF.ts` — orquestrador: extrai texto do PDF via pdfjs, detecta banco, chama parser específico  
- `lib/parsers/parseItauPDF.ts` — parser de fatura Itaú  
- `lib/parsers/parseBBPDF.ts` — parser de fatura Banco do Brasil  
- `lib/parsers/parseMercadoPagoPDF.ts` — parser de fatura Mercado Pago  

### 3. Sem chamadas de API  
Tudo ocorre no browser via `FileReader.readAsArrayBuffer` + `pdfjs-dist`.

---

## 🛠️ Estrutura de Código Esperada  

### Configuração do worker pdfjs (`lib/parsePDF.ts` — topo do arquivo)  
```ts
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()
```

### Extração de texto linha a linha (`lib/parsePDF.ts`)  
```ts
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

async function extractLines(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const allLines: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Agrupar itens por coordenada Y (mesma linha = Y similar com tolerância de 2px)
    const byY = new Map<number, TextItem[]>()
    for (const item of textContent.items) {
      if (!('str' in item)) continue
      const y = Math.round((item as TextItem).transform[5])
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push(item as TextItem)
    }

    // Ordenar linhas de cima para baixo (Y decrescente no sistema de coordenadas do PDF)
    const sortedYs = [...byY.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const items = byY.get(y)!.sort((a, b) => a.transform[4] - b.transform[4])
      const line = items.map(i => i.str).join(' ').trim()
      if (line) allLines.push(line)
    }
  }

  return allLines
}
```

### Detecção de banco (`lib/parsePDF.ts`)  
```ts
function detectBank(lines: string[]): 'itau' | 'bb' | 'mercadopago' | null {
  const fullText = lines.join(' ').toLowerCase()
  if (fullText.includes('itaú') || fullText.includes('itau unibanco')) return 'itau'
  if (fullText.includes('banco do brasil') || fullText.includes('ourocard')) return 'bb'
  if (fullText.includes('mercado pago') || fullText.includes('mercadopago')) return 'mercadopago'
  return null
}
```

### Orquestrador (`lib/parsePDF.ts`)  
```ts
export async function parsePDF(arrayBuffer: ArrayBuffer): Promise<OFXParseResult> {
  const lines = await extractLines(arrayBuffer)
  const bank = detectBank(lines)

  if (bank === 'itau') return parseItauPDF(lines)
  if (bank === 'bb') return parseBBPDF(lines)
  if (bank === 'mercadopago') return parseMercadoPagoPDF(lines)

  throw new Error('Banco não reconhecido. PDFs suportados: Itaú, Banco do Brasil e Mercado Pago.')
}
```

### Parser Itaú (`lib/parsers/parseItauPDF.ts`)  

**Estrutura das páginas de transações:**
- Seção `Pagamentos efetuados`: linhas `DD/MM DESCRIÇÃO -VALOR` (valores já negativos)
- Seção `Lançamentos: compras e saques`: linhas `DD/MM ESTABELECIMENTO CIDADE VALOR` (positivo, sem R$)
- Seção `Lançamentos: produtos e serviços`: linhas `DD/MM DESCRIÇÃO VALOR` (positivo, sem R$)
- Linhas de categoria intercaladas (ex: `saúde ITATIBA`, `outros SAO PAULO`) devem ser ignoradas — não começam com `DD/MM`
- Linhas de total (`Lançamentos no cartão`, `Total dos pagamentos`, etc.) devem ser ignoradas

**Padrão da linha de transação:** `/^(\d{2}\/\d{2})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$/`

**Extração do vencimento:** linha contendo `Vencimento:` com formato `DD/MM/YYYY`

**Extração do saldo:** linha contendo `Total desta fatura` seguida do valor

**Regra de sinal:**
- Valores com `-` (seção de pagamentos) → mantém negativo (pagamento = verde)
- Demais → positivo (gasto = vermelho)

```ts
export function parseItauPDF(lines: string[]): OFXParseResult {
  // Extrair vencimento para inferir o ano
  // Iterar linhas com regex de transação
  // Aplicar regra de sinal
  // Extrair saldo e fileName
}
```

### Parser Banco do Brasil (`lib/parsers/parseBBPDF.ts`)  

**Estrutura:**
- Tabela de lançamentos: colunas `Data | Descrição | País | Valor`
- Linhas de transação: `DD/MM DESCRIÇÃO BR R$ VALOR` ou `DD/MM DESCRIÇÃO CA R$ VALOR` ou `DD/MM DESCRIÇÃO R$ VALOR`
- Linhas sem data são cabeçalhos de seção (ex: `Bancos`, `Restaurantes`, `Pagamentos/Créditos`) — ignorar
- `SALDO FATURA ANTERIOR` — ignorar
- Pagamentos já vêm com `R$ -3.841,22` — manter negativo

**Padrão com país:** `/^(\d{2}\/\d{2})\s+(.+?)\s+(?:BR|CA)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})$/`  
**Padrão sem país:** `/^(\d{2}\/\d{2})\s+(.+?)\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})$/`

**Extração do vencimento:** linha `Vencimento DD/MM/YYYY` na página 1

**Extração do saldo:** linha `Total da Fatura R$ VALOR`

**Conversão de valor:** `parseFloat(raw.replace('R$','').replace('.','').replace(',','.').trim())`

### Parser Mercado Pago (`lib/parsers/parseMercadoPagoPDF.ts`)  

**Estrutura:**
- Seção `Movimentações na fatura`: lançamentos gerais (pagamentos, tarifas, devoluções)
- Seções `Cartão Visa [************XXXX]`: compras por cartão
- Linhas de transação em todas as seções: `DD/MM DESCRIÇÃO [Parcela X de Y] R$ VALOR`
- Linhas de total (`Total R$ VALOR`) — ignorar
- Linhas de cabeçalho de seção (`Data Movimentações Valor em R$`, `Cartão Visa`) — ignorar

**Padrão da linha:** `/^(\d{2}\/\d{2})\s+(.+?)\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/`

**Regra de sinal:**
- Dentro de `Movimentações na fatura`: se a descrição contiver `pagamento` ou `devolução` (case-insensitive) → negativo; caso contrário → positivo
- Dentro de seções `Cartão Visa` → sempre positivo

**Extração do vencimento:** linha `Vence em DD/MM/YYYY` na página 1

**Extração do saldo:** linha `Total a pagar R$ VALOR` ou `Total R$ VALOR` no resumo da página 1

### Tipagens (`src/lib/types.ts`) — acréscimo  
```ts
// Acrescentar ao arquivo existente (não substituir):
export type SupportedBank = 'itau' | 'bb' | 'mercadopago' | 'ofx'

// OFXParseResult já existente permanece igual — parsers de PDF retornam o mesmo tipo
```

### Atualização da DropZone (`src/components/DropZone.tsx`)  
```tsx
// Alterar validação:
function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.ofx') || name.endsWith('.pdf')
}

// Alterar input:
<input accept=".ofx,.pdf" ... />

// Alterar processFile:
async function processFile(file: File): Promise<void> {
  if (!isSupportedFile(file)) {
    onError('Formato inválido. Por favor, importe um arquivo .ofx ou .pdf.')
    return
  }

  if (file.name.toLowerCase().endsWith('.ofx')) {
    // fluxo OFX existente (FileReader.readAsText)
  } else {
    // novo fluxo PDF (FileReader.readAsArrayBuffer + parsePDF)
    reader.readAsArrayBuffer(file)
    reader.onload = async () => {
      const result = await parsePDF(reader.result as ArrayBuffer)
      onFileParsed(result)
    }
  }
}
```

---

## 🔐 Considerações de Segurança  
- A extração de texto via pdfjs ocorre inteiramente no browser — nenhum dado é enviado para servidor.
- O ArrayBuffer do arquivo não deve ser armazenado em `localStorage` nem `sessionStorage`.
- Não usar `eval` nem `innerHTML` em nenhum momento do parse.
- Validar extensão do arquivo antes de qualquer processamento.

---

## 🧪 Testes (Vitest + React Testing Library)  

### Instalação adicional  
Nenhuma — Vitest e Testing Library já estão instalados.

### Casos de teste  

#### `lib/parsers/parseItauPDF.test.ts`  
- Extrair transações corretamente de um array de linhas simulando o texto do Itaú  
- Converter `DD/MM` + ano inferido → `DD/MM/YYYY`  
- Manter negativo o valor de linha de pagamento (`-146,80`)  
- Ignorar linhas de categoria (sem `DD/MM`)  
- Ignorar linha `Lançamentos no cartão 899,91`  

#### `lib/parsers/parseBBPDF.test.ts`  
- Extrair transações com país `BR` e `CA`  
- Manter negativo o valor de pagamento `R$ -3.841,22`  
- Ignorar linhas de seção (`Bancos`, `Restaurantes`) e `SALDO FATURA ANTERIOR`  
- Extrair saldo `Total da Fatura`  

#### `lib/parsers/parseMercadoPagoPDF.test.ts`  
- Extrair transações da seção `Movimentações na fatura`  
- Atribuir valor negativo para descrição contendo `Pagamento`  
- Atribuir valor negativo para descrição contendo `Devolução`  
- Atribuir valor positivo para `Tarifa`  
- Extrair transações de seção `Cartão Visa` como positivas  
- Ignorar linhas `Total R$ 117,09` e cabeçalhos de seção  

#### `lib/parsePDF.test.ts`  
- Retornar banco `itau` para texto contendo `itaú`  
- Retornar banco `bb` para texto contendo `banco do brasil`  
- Retornar banco `mercadopago` para texto contendo `mercado pago`  
- Lançar erro para texto não reconhecido  

#### `components/DropZone.test.tsx` — testes adicionais  
- Aceitar arquivo `.pdf` sem erro de validação  
- Chamar `onError` com mensagem correta para arquivo `.csv`  

### Mocks necessários  
- Mock de `pdfjs-dist` nos testes dos parsers (os parsers recebem `string[]` já extraídas — não dependem do pdfjs diretamente)
- Mock de `FileReader` para o teste de `.pdf` na DropZone  
- Mock de `parsePDF` no teste da DropZone para isolar a integração com pdfjs  

---

## 🧠 Critérios de Aceite  
- Soltar um `.pdf` do Itaú, BB ou Mercado Pago na dropzone exibe a prévia corretamente  
- Soltar um `.pdf` de banco não suportado exibe a mensagem de banco não reconhecido  
- Soltar um `.csv` exibe a mensagem de formato inválido  
- Soltar um `.ofx` continua funcionando exatamente como antes (regressão zero)  
- Valores de gastos aparecem positivos (vermelho); pagamentos/devoluções aparecem negativos (verde)  
- O ano das transações é inferido corretamente da data de vencimento do PDF  
- O saldo exibido no rodapé corresponde ao total da fatura extraído do PDF  
- `npm run lint` — zero erros  
- `npm run typecheck` — zero erros  
- `npm run test` — todos os testes passando  

---

## 📦 Saída esperada (do agente implementador)  
1. Instalação de `pdfjs-dist` via `npm install pdfjs-dist`  
2. Arquivo `src/lib/parsePDF.ts` com worker config, `extractLines`, `detectBank` e `parsePDF`  
3. Arquivo `src/lib/parsers/parseItauPDF.ts` com `parseItauPDF(lines: string[]): OFXParseResult`  
4. Arquivo `src/lib/parsers/parseBBPDF.ts` com `parseBBPDF(lines: string[]): OFXParseResult`  
5. Arquivo `src/lib/parsers/parseMercadoPagoPDF.ts` com `parseMercadoPagoPDF(lines: string[]): OFXParseResult`  
6. Atualização de `src/components/DropZone.tsx` para suportar `.pdf` e `.ofx`  
7. Atualização de `src/lib/types.ts` com o tipo `SupportedBank` (opcional, sem alterar interfaces existentes)  
8. Testes unitários para cada parser e para os novos casos da DropZone  
9. Confirmação de que `npm run lint`, `npm run typecheck` e `npm run test` passam sem erros  

---

Responder sempre em **português do Brasil**, com tom técnico e direto.

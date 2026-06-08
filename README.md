# Conversor de Faturas

Utilitário pessoal para converter faturas de cartão de crédito (OFX e PDF) em planilha Excel.

Processa arquivos localmente — nenhum dado é enviado para servidores externos.

## Pré-requisitos

- Node.js 18+
- [Ollama](https://ollama.com) instalado (necessário apenas para o modo IA)

## Instalação

```bash
npm install
```

## Rodando

```bash
npm run dev
```

Isso sobe dois processos simultaneamente:

- **Frontend:** http://localhost:5173
- **Backend local:** http://localhost:3001

## IA local (Ollama)

O `npm run dev` já tenta iniciar o Ollama automaticamente. Se ele já estiver rodando, continua normalmente.

Antes do primeiro uso, baixe o modelo:

```bash
ollama pull qwen2.5:7b
```

Na interface, marque **"Usar IA local"** antes de enviar o PDF.

Modelos alternativos compatíveis: `llama3.1:8b`, `mistral:7b`.

## Formatos suportados

| Formato | Modo disponível |
|---------|----------------|
| `.ofx`  | Parser local no browser |
| `.pdf`  | Parser por banco (Itaú, BB, Mercado Pago) ou IA local |

## Configuração avançada

Copie `.env.example` para `.env` e ajuste as variáveis conforme necessário:

```bash
cp .env.example .env
```

## Outros comandos

```bash
npm run test        # testes unitários
npm run typecheck   # verificação de tipos (frontend)
npm run build       # build de produção
```

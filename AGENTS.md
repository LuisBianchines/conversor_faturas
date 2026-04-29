# AGENTS.md — Regras Unificadas para Agentes de IA (Copilot + Codex)

Este documento consolida todas as regras que **Copilot, Codex e demais agentes de IA** devem seguir ao escrever ou modificar código neste repositório.  
O objetivo é garantir **consistência, segurança, testabilidade e qualidade máxima** em todos os desenvolvimentos frontend realizados.

---

# 🎯 Objetivo Geral

Gerar código:

- **Segurança-first**
- **Escalável e modular**
- **Performático**
- **Totalmente tipado (TypeScript)**
- **Acessível (a11y)**
- **Testável (Jest + Testing Library)**
- **Compatível com CI/CD**
- **Sem quebras de lint, testes, formato ou typecheck**

Nenhuma entrega pode ser considerada completa sem passar pelo checklist obrigatório ao final.

---

# 💻 Stack Oficial do Projeto

- **React + TypeScript + Vite**
- **TailwindCSS + Ant Design**
- **Zustand**
- **react-router-dom**
- **react-hook-form**
- **Jest + Testing Library**
- **ESLint + Prettier**
- Deploy em:
  - **S3 + CloudFront + Cloudflare**

---

# 🧱 1. Estrutura e Padrões de Código

- Código **modular**, **legível** e **organizado**.
- Pastas obrigatórias:
  - `components/`
  - `hooks/`
  - `pages/`
  - `lib/`
  - `store/`
  - `assets/`
- Convenções:
  - Componentes → **PascalCase**
  - Hooks → **useSomething**
  - Variáveis/funções → **camelCase**
  - Constantes → **SCREAMING_SNAKE_CASE**
- Nunca usar `any`.
- Remover código morto.
- Aplicar DRY, Single Responsibility e Clean Code.

---

# ⚛️ 2. Boas Práticas React

- Regras de Hooks sempre respeitadas.
- Manter estado mínimo.
- Evitar re-renders desnecessários.
- `useMemo`, `useCallback`, `React.memo` apenas quando necessário.
- Lazy-loading de rotas/componentes.
- Hooks para lógicas complexas.
- Não usar `dangerouslySetInnerHTML`.

---

# ♿ 3. Acessibilidade

- Labels em todos inputs.
- Navegação por teclado funcional.
- Foco visível.
- `aria-live` para conteúdo dinâmico.
- Não usar cor como único meio de informação.
- IDs únicos (`useId`).

---

# 📱 4. Responsividade

- Mobile-first.
- Tailwind breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`.
- Testes visuais em:
  - 360×640
  - 390×844
  - 768×1024
  - 1280×720
  - 1440×900

---

# 🚀 5. Performance e Web Vitals

- Importações otimizadas.
- Imagens otimizadas (`webp`, `avif`).
- Lazy-loading.
- Debounce/throttle.
- Metas:
  - LCP < 2.5s
  - CLS < 0.1
  - INP < 200ms

---

# 🔐 6. Segurança

- Nunca expor segredos.
- Sanitizar tudo que vem da API.
- Nada de eval.
- Não armazenar dados sensíveis no navegador.
- `npm audit` limpo.

---

# 🧭 7. UX de Erros

- Nunca deixar o usuário sem feedback.
- Mensagens claras e amigáveis.
- Logs sem dados sensíveis.
- Sentry quando disponível.

---

# 🧪 8. Testes (Jest + Testing Library)

- Criar testes unitários para:
  - Componentes
  - Hooks
  - Fluxos de negócio
- Testar sucesso, erro, loading e edge cases.
- Testes não podem falhar no CI.

---

# ☁️ 9. Build e Deploy

- Builds com hash.
- Cache-Control correto.
- Brotli/Gzip.
- CSP, HSTS, X-Frame-Options.
- Deploy via S3 + CloudFront + OAC.

---

# 🧭 10. Fluxo de Trabalho do Agente IA

1. Ler todo o contexto primeiro.
2. Planejar antes de codar.
3. Escrever código limpo, modular e testado.
4. Rodar comandos obrigatórios:

```
npm run test
npm run lint
npm run lint:fix
npm run format:check
npm run format:write
npm run typecheck
```

5. Corrigir tudo que falhar.
6. Explicar entrega:
   - O que foi modificado
   - Como testar
   - Arquivos tocados

---

# 🚫 11. Proibições

- Não adicionar dependências sem permissão.
- Não refatorar tudo sem necessidade.
- Não remover testes para “fazer passar”.
- Não ignorar erros do lint/typecheck.
- Não hardcodear strings mágicas.

---

# 🧪 12. Definition of Done — Checklist Final

A tarefa só pode ser finalizada quando:

### ✔️ Testes

```
npm run test
```

### ✔️ Lint

```
npm run lint
npm run lint:fix
```

### ✔️ Formatação

```
npm run format:check
npm run format:write
```

### ✔️ Tipagem

```
npm run typecheck
```

### Resultado esperado:

| Item           | Status                 |
| -------------- | ---------------------- |
| Testes         | ✅ 100% passando       |
| Lint           | ✅ zero erros/warnings |
| Format         | ✅ sem diffs           |
| Typecheck      | ✅ sem erros           |
| Acessibilidade | ✅ garantida           |
| Responsividade | ✅ testada             |
| Segurança      | ✅ sanitização correta |

---

# 🔥 Regra Suprema

> **Todo código produzido por agentes deve estar pronto para produção, seguindo absolutamente todas as regras deste documento e nunca quebrando o pipeline.**
> **Sempre criar o commit ao final do desenvolvimento.**

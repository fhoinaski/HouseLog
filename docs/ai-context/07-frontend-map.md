# 07 - Frontend Map

## Stack

Next.js App Router, React, TypeScript, Tailwind, SWR, React Hook Form, Zod e PWA.

## Diretorios

- `src/app`: rotas App Router.
- `src/components`: componentes de UI, layout, propriedades, servicos, documentos, handover e provider.
- `src/lib/api`: clients modulares da API.
- `src/lib/api/core`: HTTP, sessao, storage, tipos e configuracao.
- `src/lib`: auth context, offline queues, sync e utilitarios.

## Rotas principais

- App autenticado: `src/app/(app)`.
- Auth: `src/app/(auth)`.
- Propriedades: `src/app/(app)/properties`.
- Contexto de imovel: `src/app/(app)/properties/[id]`.
- Provider: `src/app/provider`.
- Publicas tokenizadas: `src/app/audit/[token]`, `src/app/share/service/[token]`, `src/app/invite/[token]`, `src/app/handover/[token]`.

## Design system

Sistema oficial: The Architectural Lens. Use componentes e tokens existentes. Nao crie mini design system por pagina.

## Regras para IA

- Nao inventar endpoint ou campo.
- Conferir API client antes de alterar payload.
- Preservar loading, empty e error states.
- Nao criar autorizacao somente no frontend.
- Nao persistir tokens ou credenciais em storage.
- Nao exibir secrets em listagens.
- Para documentos/upload, nao expor URLs privadas diretamente.

## Validacao comum

Para mudancas frontend, preferir `npm run type-check`, `npm run lint`, testes relevantes e `git diff --check`.


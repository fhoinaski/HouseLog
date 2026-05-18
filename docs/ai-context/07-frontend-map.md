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

## Provider Flow (2026-05-17)

- `src/app/provider/services/[serviceId]/page.tsx`: exibe `after_photos` alem das `before_photos`, checklist read-only com progresso. Imagens clicaveis usam `<button>` + `<img alt="">` sem `onClick` direto em `img`. Upload de evidencia: botao "Enviar evidencia" visivel apenas para OS em `approved`|`in_progress`; enfileira na `houselog-oq` com `useProviderRoute: true` — o sync usa `POST /provider/services/:id/photos` (nao a rota de property, que 403 para providers).
- `src/app/provider/services/page.tsx`: migrada para `HouseLog Calm OS`; usa fundo claro, filtros acessiveis com `aria-pressed`, cards Link mobile-first, loading skeleton, erro com retry, vazio real e aviso simples de offline.
- `src/app/provider/services/[serviceId]/page.tsx`: migrada parcialmente para `HouseLog Calm OS` com fundo claro, secoes brancas, cards de detalhe/checklist/evidencias e historico de propostas preservando upload, chat e fila offline existentes.
- `src/app/provider/dashboard/page.tsx`: tela piloto do `HouseLog Calm OS`; usa fundo claro, cards brancos, nav clara via escopo da pagina, MetricCards com skeleton de loading, estado de erro com retry e zeros exibidos apenas quando dados validos.
- `src/app/provider/opportunities/page.tsx`: migrada para `HouseLog Calm OS`; chips de filtro tem `aria-pressed` e `role="group"`, cards Link mobile-first e estados loading/empty claros.
- `src/app/provider/opportunities/[serviceId]/page.tsx`: migrada parcialmente para `HouseLog Calm OS`; mantem proposta/chat e usa secoes claras.
- `src/app/provider/settings/page.tsx`: migrada parcialmente para `HouseLog Calm OS`; chips de hard skills tem `aria-pressed`, sections claras e formularios preservados.

## Propostas recebidas — Owner Service Detail (2026-05-17)

- `src/app/(app)/properties/[id]/services/[serviceId]/page.tsx`: seção "Propostas recebidas" exibe bids da OS via `bidsApi.list(propertyId, serviceId)` (SWR). Aparece quando `status === 'requested'` ou há bids carregados. Estado vazio explícito. Para `status === 'pending'`, owner/admin vê botões "Aceitar" (`bidsApi.updateStatus` com `accepted`) e "Recusar" (`rejected`). Aceitar atualiza `assigned_to`, `cost` e `status` da OS; mutate global invalida dashboard. Apenas `owner` e `admin` veem botões (não `provider`). `canReviewBids` não inclui `manager` — não existe na união de roles de `user`.

## Padrao de Chat (ServiceChat)

- `src/components/services/service-chat.tsx`: Textarea tem label acessivel via `aria-labelledby` (label `sr-only`). Composer desativado quando `forbidden=true` (403/404). Padding inferior `pb-[env(safe-area-inset-bottom,0px)]` evita sobreposicao pelo teclado virtual mobile. Botao de envio tem `aria-label` contextual.

## Design system

Sistema visual oficial: `HouseLog Calm OS`. Fonte curta: `docs/design/house-log-calm-os.md`.

- Tema atual: `HouseLog Calm OS`.
- Tema legado: dark/tech anterior (`The Architectural Lens` visual), mantido apenas para telas ainda nao migradas.
- Tokens globais ficam em `src/app/tokens.css` (`--hl-bg`, `--hl-surface`, `--hl-border`, `--hl-text`, `--hl-primary`, status e sombras).
- Ponte Tailwind fica em `src/app/globals.css` com classes como `bg-hl-bg`, `bg-hl-surface`, `border-hl-border`, `text-hl-text`, `text-hl-text-muted`, `text-hl-primary`, `shadow-hl-subtle` e `shadow-hl-soft`.
- `AppShell` aplica o wrapper explicito `.hl-calm-os` para fundo, texto e navegacao autenticada clara. Novas telas devem usar `.hl-calm-os` ou tokens Calm OS; nao usar novos seletores `:has()` como mecanismo principal de tema.
- Helpers globais em `globals.css`: `.hl-calm-card`, `.hl-calm-surface`, `.hl-calm-section`, `.hl-calm-muted`, `.hl-calm-border`, `.hl-calm-focus` e `.hl-calm-bottom-safe`.
- `TopNav`, `BottomNav` e `PropertyMobileContextControls` usam classes Calm OS diretas (`bg-hl-surface`, `border-hl-border`, `shadow-hl-*`) alem do wrapper.
- `src/components/ui/visual-system.ts`: variantes compartilhadas de `PageSection`, `MetricCard`, `ActionTile`, `ServiceOrderCard`, `PropertySummaryCard`, `EmptyState` e `ChatPanel` usam base Calm OS (surface branca, borda suave, sombra discreta).
- `src/components/ui/dialog.tsx`: overlay migrado para `bg-black/40`; conteudo usa `bg-hl-surface border-hl-border text-hl-text shadow-hl-soft`; descricao usa `text-hl-text-muted`.
- Componentes novos devem usar tokens semanticos (`--hl-bg`, `--hl-surface`, `--hl-text`, `--hl-border`, `--hl-primary` e status tokens). Nao criar novos componentes com cores hardcoded.
- `The Architectural Lens` permanece como base legada ate a migracao gradual. Nao apagar tokens antigos sem mapear consumidores.
- Migrar por tela/componente, preservando loading, empty, error states e contratos de API. Prioridade atual: provider flow, owner dashboard, imoveis, OS/propostas, documentos/handover e auth/login.

## Owner/Manager Calm OS (2026-05-17)

- `src/app/(app)/dashboard/page.tsx`: entrada owner/manager alinhada ao Calm OS via surfaces claras e componentes compartilhados.
- `src/app/(app)/properties/page.tsx`: lista de imoveis recebeu base Calm OS em shell/header/cards e reducao de overlay dark/glass pesado.
- `src/app/(app)/properties/[id]/page.tsx`: detalhe do imovel recebeu base Calm OS no wrapper e hero, reduzindo overlay escuro sem alterar abas/modulos.

## Auth/Public Calm OS (2026-05-17)

- `src/components/auth/entry-shell.tsx`: login/register usam base Calm OS clara, cards brancos e sem glass pesado.
- `src/app/splash/page.tsx`: splash usa fundo Calm OS claro e reduz gradientes/glass pesados.
- `src/app/invite/[token]/page.tsx`: convite publico usa base Calm OS clara no wrapper, logo e card principal.
- `src/app/(auth)/login/page.tsx`: tokens antigos (`text-text-secondary`, `text-text-accent`, `var(--provider-accent)`, `var(--divider-color)`, `var(--field-focus-ring)`) substituidos por tokens Calm OS (`text-hl-text-muted`, `text-hl-primary`, `var(--hl-primary)`, `bg-hl-border`).
- `src/app/(auth)/register/page.tsx`: mesma migracao de tokens antigos + role cards com superficie Calm OS, step indicator com `bg-hl-primary`, success state com `bg-hl-surface-muted text-hl-success`.
- `src/app/(auth)/layout.tsx`: spinner de loading usa `bg-hl-bg` e `border-hl-primary`.

## Regras para IA

- Nao inventar endpoint ou campo.
- Conferir API client antes de alterar payload.
- Preservar loading, empty e error states.
- Nao criar autorizacao somente no frontend.
- Nao persistir tokens ou credenciais em storage.
- Nao exibir secrets em listagens.
- Para documentos/upload, nao expor URLs privadas diretamente.
- Fila offline de OS usa `src/lib/offline-queue.ts` (`houselog-oq`) com `tenantId + userId + propertyId + serviceOrderId`; a fila legada `houselog-eq` deve ser limpa, nao migrada sem contexto confiavel. `OqPhotoItem` tem campo opcional `useProviderRoute?: boolean` — quando `true`, o sync usa `POST /provider/services/:id/photos` em vez da rota de property.
- Sync offline e foreground-only: roda com access token em memoria no mount/`online`; nao implementar Background Sync sem redesenho de auth.
- Itens `requires_action` (max attempts ou idade > 7 dias) expoe UX explicita em `OfflineSyncStatus`: painel expansivel com "Tentar novamente" e "Remover pendencia" (com confirmacao inline). `retryManualItem` e `removeItem` em `offline-queue.ts` validam `tenantId + userId` antes de qualquer mutacao — Blob nunca removido sem confirmacao. Hook `useOfflineQueueSync` expoe `manualActionItems: OqItemView[]` (sem Blob, sem token), `retryManualItem(id)` e `removeManualItem(id)`.

## Validacao comum

## Provider evidence upload delta (2026-05-17)

- `/provider/services/[serviceId]`: botao "Enviar evidencia" usa `order.can_upload_evidence` quando presente. Online chama `providerApi.uploadEvidence(serviceId, file)` em `POST /provider/services/:id/photos`, mostra loading, faz `mutate()` e exibe toast de sucesso. Offline/falha de rede enfileira em `houselog-oq` com `useProviderRoute: true`; erros HTTP mostram feedback e nao fingem sucesso.
- `providerApi.uploadEvidence`: upload multipart provider dedicado, sem rota owner/manager.
- `useOfflineQueueSync`: quando `useProviderRoute=true`, sincroniza em `/provider/services/:id/photos` e normaliza erro novo/legado.

Para mudancas frontend, preferir `npm run type-check`, `npm run lint`, testes relevantes e `git diff --check`.

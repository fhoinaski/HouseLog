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
- `src/app/provider/dashboard/page.tsx`: MetricCards tem skeleton de loading, estado de erro com retry e zeros exibidos apenas quando dados validos.
- `src/app/provider/opportunities/page.tsx`: chips de filtro tem `aria-pressed` e `role="group"`.
- `src/app/provider/settings/page.tsx`: chips de hard skills tem `aria-pressed`.

## Propostas recebidas — Owner Service Detail (2026-05-17)

- `src/app/(app)/properties/[id]/services/[serviceId]/page.tsx`: seção "Propostas recebidas" exibe bids da OS via `bidsApi.list(propertyId, serviceId)` (SWR). Aparece quando `status === 'requested'` ou há bids carregados. Estado vazio explícito. Para `status === 'pending'`, owner/admin vê botões "Aceitar" (`bidsApi.updateStatus` com `accepted`) e "Recusar" (`rejected`). Aceitar atualiza `assigned_to`, `cost` e `status` da OS; mutate global invalida dashboard. Apenas `owner` e `admin` veem botões (não `provider`). `canReviewBids` não inclui `manager` — não existe na união de roles de `user`.

## Padrao de Chat (ServiceChat)

- `src/components/services/service-chat.tsx`: Textarea tem label acessivel via `aria-labelledby` (label `sr-only`). Composer desativado quando `forbidden=true` (403/404). Padding inferior `pb-[env(safe-area-inset-bottom,0px)]` evita sobreposicao pelo teclado virtual mobile. Botao de envio tem `aria-label` contextual.

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
- Fila offline de OS usa `src/lib/offline-queue.ts` (`houselog-oq`) com `tenantId + userId + propertyId + serviceOrderId`; a fila legada `houselog-eq` deve ser limpa, nao migrada sem contexto confiavel. `OqPhotoItem` tem campo opcional `useProviderRoute?: boolean` — quando `true`, o sync usa `POST /provider/services/:id/photos` em vez da rota de property.
- Sync offline e foreground-only: roda com access token em memoria no mount/`online`; nao implementar Background Sync sem redesenho de auth.
- Itens `requires_action` (max attempts ou idade > 7 dias) expoe UX explicita em `OfflineSyncStatus`: painel expansivel com "Tentar novamente" e "Remover pendencia" (com confirmacao inline). `retryManualItem` e `removeItem` em `offline-queue.ts` validam `tenantId + userId` antes de qualquer mutacao — Blob nunca removido sem confirmacao. Hook `useOfflineQueueSync` expoe `manualActionItems: OqItemView[]` (sem Blob, sem token), `retryManualItem(id)` e `removeManualItem(id)`.

## Validacao comum

## Provider evidence upload delta (2026-05-17)

- `/provider/services/[serviceId]`: botao "Enviar evidencia" usa `order.can_upload_evidence` quando presente. Online chama `providerApi.uploadEvidence(serviceId, file)` em `POST /provider/services/:id/photos`, mostra loading, faz `mutate()` e exibe toast de sucesso. Offline/falha de rede enfileira em `houselog-oq` com `useProviderRoute: true`; erros HTTP mostram feedback e nao fingem sucesso.
- `providerApi.uploadEvidence`: upload multipart provider dedicado, sem rota owner/manager.
- `useOfflineQueueSync`: quando `useProviderRoute=true`, sincroniza em `/provider/services/:id/photos` e normaliza erro novo/legado.

Para mudancas frontend, preferir `npm run type-check`, `npm run lint`, testes relevantes e `git diff --check`.

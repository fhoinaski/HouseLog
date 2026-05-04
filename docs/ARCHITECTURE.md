# Arquitetura do HouseLog

## Visao geral

O HouseLog e uma plataforma SaaS privada para governanca operacional, memoria tecnica, manutencao e historico de imoveis premium. A arquitetura atual separa claramente frontend, backend e contratos compartilhados para manter evolucao incremental, seguranca e compatibilidade entre as camadas.

A stack atual e:

- Frontend: Next.js, React e TypeScript.
- Backend: Cloudflare Workers com Hono.
- Banco: Cloudflare D1/SQLite com Drizzle ORM.
- Storage: Cloudflare R2.
- Contratos: schemas Zod e tipos compartilhados em `packages/contracts`.
- Autenticacao: JWT, refresh token e MFA.
- Auditoria: `writeAuditLog` com sanitizacao por `sanitizeAuditData`.

## Separacao por diretorios

- `house-log-front`: aplicacao web/PWA, interface, client de API e experiencia de usuario.
- `house-log-back`: API, rotas Hono, middleware, schema Drizzle, migrations, helpers de dominio e testes de backend.
- `packages/contracts`: fonte compartilhada para schemas Zod, DTOs e tipos usados entre backend e frontend.
- `docs`: documentacao tecnica, regras de arquitetura, seguranca, multi-tenant, roadmap e guia para agentes.

O frontend nao deve implementar regra de autorizacao como fonte de verdade. O backend nao deve depender de estado visual ou comportamento de UI para proteger dados.

## Papel de `packages/contracts`

`packages/contracts` e a fonte principal para validacao de input e tipos compartilhados. Novas features que possuem payload de API devem preferir contracts Zod reutilizaveis em vez de schemas duplicados dentro das rotas.

Os contracts de input nao devem aceitar campos server-only, como:

- `tenantId`;
- `createdBy`;
- `createdAt`;
- `updatedAt`;
- secrets;
- ciphertext;
- keys privadas de R2.

Campos derivados do contexto autenticado devem ser preenchidos no backend.

## Fluxo basico de request

1. O frontend chama a API usando o client modularizado.
2. A rota Hono recebe a requisicao.
3. `authMiddleware` valida autenticacao quando a rota e privada.
4. `resolveTenant` resolve o tenant efetivo do usuario autenticado.
5. A rota valida parametros e body com Zod.
6. A autorizacao valida contexto, papel, `tenantId` e `propertyId`.
7. A rota executa query Drizzle/D1 filtrando pelo escopo correto.
8. Mutacoes criticas registram `writeAuditLog`.
9. A resposta retorna apenas dados permitidos ao contexto atual.

## Padrao de rotas backend

Rotas backend devem:

- usar Hono;
- validar input com Zod;
- usar `authMiddleware` em rotas privadas;
- usar `resolveTenant` em rotas tenant-aware;
- validar acesso ao imovel com `assertTenantPropertyAccess` ou `requireTenantPropertyAccess`;
- retornar 404 para registros fora do tenant ou do imovel;
- evitar logica de negocio complexa diretamente no handler quando houver helper existente;
- usar helpers tenant-aware para validar vinculos entre entidades.

Rotas publicas ou tokenizadas devem ter escopo minimo, token verificavel, expiracao e nao podem abrir acesso indireto a dados privados.

## Padrao de entidades

Entidades de dominio devem ter:

- `id`;
- `tenant_id`;
- `property_id` quando fizerem parte do prontuario ou operacao de um imovel;
- campos de negocio claros;
- `created_at`;
- `updated_at`;
- `deleted_at` quando fizer sentido preservar historico tecnico;
- indices por `tenant_id`, `property_id` e relacionamentos principais.

Entidades premium e de historico tecnico devem priorizar rastreabilidade. Evite hard delete quando o dado compoe garantias, reformas, handover, documentos, ordens de servico ou eventos relevantes do imovel.

## Padrao de soft delete

Para entidades com soft delete:

- a tabela deve ter `deleted_at`;
- listagens devem filtrar `deleted_at IS NULL`;
- leitura por ID deve filtrar `deleted_at IS NULL`;
- update nao deve alterar registro deletado;
- delete deve setar `deleted_at` e `updated_at`;
- auditoria deve registrar a acao de delete com `tenantId` e `propertyId`.

Soft delete e o padrao recomendado para entidades premium com valor historico.

## Padrao de audit log

Mutacoes criticas devem chamar `writeAuditLog`. O evento deve incluir, quando aplicavel:

- `tenantId`;
- `propertyId`;
- tipo da entidade;
- ID da entidade;
- acao executada;
- usuario ator;
- IP do ator quando disponivel;
- dados antigos e novos sanitizados.

Use `sanitizeAuditData` para evitar persistir secrets, tokens, ciphertext, credenciais ou payloads sensiveis.

## Validacao com Zod

Todo input externo deve ser validado antes de uso. O padrao recomendado e:

- params de rota validados;
- query strings validadas;
- body validado com contracts compartilhados;
- updates parciais com schemas `.partial()` ou schemas especificos;
- enums definidos explicitamente;
- rejeicao de payloads desconhecidos ou inseguros quando necessario.

Validacao de Zod nao substitui autorizacao. Payload valido ainda precisa passar por tenant, property e permissao.

## Nao misturar UI com backend

Mudancas de backend nao devem criar UI. Mudancas de frontend nao devem inventar endpoints, payloads ou regras que nao existam no backend.

Quando um contrato muda, revisar:

- rota backend;
- schema Zod;
- tipo compartilhado;
- client frontend;
- telas consumidoras;
- estados de erro;
- testes.

## Decisoes arquiteturais atuais

- Backend serverless em Cloudflare Workers com Hono.
- D1/SQLite com Drizzle para persistencia tipada.
- R2 para midia e anexos, com cuidado especial para midia privada.
- Multi-tenant por `tenant_id` como regra central de isolamento.
- Contratos Zod compartilhados como fonte de validacao.
- JWT, refresh token e MFA para autenticacao.
- Audit log tenant-aware para acoes sensiveis.
- Soft delete para entidades premium e historico tecnico.

## Proximos pontos de melhoria

- Ampliar testes HTTP/D1 end-to-end para rotas tenant-aware.
- Consolidar catalogo de eventos de auditoria por entidade.
- Revisar exposicao e fluxo autenticado de midia privada R2.
- Evoluir documentacao de permissions por papel.
- Fortalecer padrao de filtros e paginacao em entidades premium.
- Documentar claramente lifecycle de handover, checklist, PDF e dossie tecnico.

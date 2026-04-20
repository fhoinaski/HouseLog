# AGENTS.md — HouseLog Backend

## Objetivo

Este arquivo define as regras específicas de backend para qualquer agente que trabalhe em `house-log-back`.

O agente deve atuar como:
- engenheiro backend sênior;
- especialista em APIs HTTP;
- especialista em Hono;
- especialista em Cloudflare Workers;
- especialista em D1 + Drizzle;
- especialista em segurança de aplicação;
- especialista em modelagem incremental de domínio.

Toda alteração no backend deve:
- respeitar a arquitetura real;
- preservar contratos existentes;
- manter segurança e previsibilidade;
- preservar tipagem forte;
- evitar acoplamento desnecessário;
- manter rastreabilidade e manutenção.

---

## Stack obrigatória do backend

O backend deve ser construído e mantido com:
- Cloudflare Workers
- Hono
- TypeScript
- D1 (SQLite)
- Drizzle ORM
- R2
- KV
- Queues
- Workers AI
- Resend

---

## Arquitetura funcional do backend

O backend do HouseLog atende um domínio real de gestão imobiliária operacional com foco em:
- autenticação e autorização;
- propriedades;
- ordens de serviço;
- bids/orçamentos;
- mensagens por OS;
- manutenção preventiva;
- documentos;
- financeiro;
- provider portal;
- marketplace;
- auditoria e compartilhamento.

O agente nunca deve tratar a API como CRUD genérico sem contexto.

---

## Arquivos de referência prioritários

Antes de alterar comportamento, ler quando aplicável:
- `apps/api/src/index.ts`
- `apps/api/src/routes/*`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/migrations/*`
- `apps/api/src/lib/*`
- `apps/api/src/middleware/*`
- `apps/api/wrangler.toml`

Também considerar:
- `DOCUMENTACAO_COMPLETA_HOUSELOG.md`

---

## Regra crítica do backend

O agente nunca deve:
- inventar endpoint;
- inventar payload fora do domínio;
- alterar contrato sem revisar impacto no frontend;
- quebrar regra de autorização por papel;
- misturar regra de negócio complexa diretamente na camada de rota sem necessidade;
- usar tipagem fraca;
- usar `any` sem necessidade real;
- ocultar erro estrutural com gambiarra;
- duplicar validação em múltiplos pontos sem motivo;
- ignorar efeitos colaterais operacionais.

Sempre:
1. entender a regra de negócio real;
2. validar entidades e relações afetadas;
3. revisar rotas, schema e consumidor;
4. implementar com menor impacto seguro;
5. manter coerência entre domínio, rota e persistência.

---

## Regras de contrato e compatibilidade

Toda mudança deve preservar:
- shape dos payloads quando possível;
- semântica dos status HTTP;
- autorização correta;
- previsibilidade de erro;
- coerência entre leitura e escrita;
- compatibilidade com o frontend existente.

Se um contrato precisar mudar:
- revisar consumidor no frontend;
- revisar tipagem;
- revisar validações;
- revisar documentação;
- revisar efeitos sobre cache/notificações.

---

## Regras de modelagem

Ao evoluir o domínio:
- preferir mudanças incrementais;
- manter nomes claros;
- evitar campos ambíguos;
- respeitar o eixo de contexto por propriedade;
- preservar a centralidade operacional de `serviceOrders`, `bids`, `messages`, `documents`, `expenses`.

Ao criar ou alterar tabelas:
- manter aderência ao domínio real;
- revisar impacto de migrations;
- evitar redundância;
- evitar colunas vagas sem função clara;
- preferir estrutura rastreável.

---

## Regras de rotas

As rotas devem:
- ser orientadas ao domínio;
- ter validação clara;
- ter autorização explícita;
- retornar payload consistente;
- usar status HTTP coerentes;
- evitar lógica inchada.

É proibido:
- colocar regra de negócio complexa diretamente no handler sem organização;
- retornar shape inconsistente entre endpoints semelhantes;
- aceitar entrada não validada;
- expor dado além do necessário para o papel atual.

---

## Regras de autenticação e autorização

O backend deve sempre considerar:
- `admin`
- `owner`
- `manager` quando aplicável no fluxo
- `provider`
- `temp_provider`

Toda alteração em rota deve revisar:
- quem pode acessar;
- em qual contexto;
- em qual fase do fluxo;
- quais campos podem ser lidos;
- quais campos podem ser escritos.

Nunca assumir acesso amplo por conveniência.

---

## Regras de segurança

Toda implementação deve priorizar:
- validação de entrada;
- autorização por papel e contexto;
- minimização de exposição de dados;
- previsibilidade em erros;
- não vazamento de informação sensível;
- tratamento seguro de arquivos, tokens e credenciais;
- cuidado com logs.

Nunca:
- expor segredo em resposta;
- logar credenciais, tokens ou payload sensível sem necessidade;
- confiar em dados do cliente sem validação;
- aceitar mutação sem checar contexto e papel.

---

## Regras de persistência e migrations

Ao alterar schema:
- revisar `schema.ts`;
- revisar migrations existentes;
- criar migração clara e incremental;
- evitar mudança destrutiva sem necessidade;
- preservar ambientes existentes;
- validar impacto em dados legados.

Toda migration deve:
- ter objetivo específico;
- ser reversível conceitualmente quando possível;
- evitar ambiguidade;
- respeitar ordem evolutiva do sistema.

---

## Regras de organização de código

Preferir separação clara entre:
- rotas;
- validação;
- acesso a dados;
- utilitários de domínio;
- integrações externas.

Evitar:
- handlers gigantes;
- lógica duplicada;
- helpers genéricos demais sem semântica;
- acoplamento circular;
- abstração excessiva sem ganho real.

---

## Regras para integrações

Ao trabalhar com:
- R2
- KV
- Queues
- Workers AI
- Resend
- push notifications

O agente deve:
- preservar contratos existentes;
- tratar erro de integração explicitamente;
- evitar side effects silenciosos;
- manter comportamento previsível;
- não quebrar fluxo principal sem necessidade.

---

## Observabilidade e erro

Toda implementação deve:
- falhar de forma compreensível;
- retornar erro consistente;
- permitir diagnóstico;
- evitar mensagens vagas;
- preservar logs úteis sem vazar dado sensível.

Erros devem:
- ser específicos;
- ser acionáveis;
- respeitar o contexto da operação.

---

## Regras técnicas obrigatórias

- manter TypeScript forte;
- evitar `any`;
- não quebrar contratos existentes sem revisar consumidores;
- manter compatibilidade com Cloudflare Workers;
- manter coerência com Drizzle;
- preservar clareza de schema e migrations;
- evitar duplicação de regra;
- manter código limpo, legível e revisável.

---

## Método obrigatório de trabalho

### 1. Diagnóstico
Antes de editar:
- ler rotas afetadas;
- ler schema relacionado;
- ler middleware envolvido;
- identificar consumidores;
- identificar riscos de regressão.

### 2. Plano
Antes de implementar:
- listar arquivos a alterar;
- listar contratos afetados;
- listar riscos;
- justificar a solução mais segura.

### 3. Implementação
Implementar de forma:
- incremental;
- segura;
- tipada;
- consistente;
- revisável.

### 4. Entrega
Sempre informar:
1. diagnóstico
2. plano
3. implementação
4. arquivos alterados
5. riscos
6. validações manuais

---

## Critério de aceite

Uma alteração de backend só está pronta se:
- respeita a arquitetura do HouseLog;
- respeita o domínio real;
- mantém autorização correta;
- mantém contrato coerente;
- mantém tipagem forte;
- não cria endpoint fictício;
- não duplica regra desnecessariamente;
- está pronta para revisão humana.

---

## Em caso de ambiguidade

Se houver ambiguidade:
- escolher a solução mais conservadora;
- preservar compatibilidade;
- não inventar domínio;
- não expandir escopo sem necessidade;
- explicar a limitação antes de aplicar.

Se houver bloqueio:
- propor a menor correção segura possível.
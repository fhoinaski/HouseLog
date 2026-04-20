# BOUNDARY_MAP.md - HouseLog

## 1. Objetivo

Este documento define o mapa oficial de fronteiras do HouseLog.

Ele deve orientar refatoracoes, revisoes de seguranca, evolucao multi-tenant, desenho de UX e uso do Codex.

O HouseLog deve ser entendido como uma plataforma privada de gestao tecnica, manutencao e confianca para imoveis premium, nao como marketplace aberto.

---

## 2. Principio central

Toda funcionalidade do HouseLog deve pertencer claramente a uma fronteira de dominio.

Uma fronteira define:
- responsabilidade principal;
- dados que controla;
- decisoes que pode tomar;
- eventos que deve auditar;
- contratos que expoe para outras partes do sistema.

Se uma funcionalidade nao se encaixa em uma fronteira, ela deve ser revisada antes de ser implementada.

---

## 3. Fronteiras principais

### 3.1 Identity and Access

Responsabilidade:
- autenticar usuarios;
- manter sessao;
- aplicar roles globais;
- apoiar MFA;
- fornecer identidade para autorizacao contextual.

Entidades atuais relacionadas:
- users;
- refresh tokens, quando aplicavel;
- MFA;
- auth context no frontend.

Contratos atuais relacionados:
- `/api/v1/auth/*`;
- `src/lib/auth-context.tsx`;
- `src/lib/api.ts`.

Nao deve:
- decidir sozinho acesso a propriedade;
- liberar acesso a credenciais sensiveis apenas por role global;
- misturar regra de membership, propriedade ou prestador.

Decisao:
- role global e apenas ponto de partida;
- acesso real deve evoluir para membership e policy contextual.

---

### 3.2 Organization and Tenant

Responsabilidade:
- representar clientes institucionais, administradoras, construtoras e portfolios;
- isolar dados por tenant;
- organizar usuarios, propriedades e rede homologada;
- permitir governanca por organizacao.

Estado atual:
- ainda nao existe tenant/organization formal como raiz do modelo;
- acesso e isolamento dependem principalmente de propriedade e usuario.

Entidades-alvo:
- organizations;
- organization_memberships;
- organization_settings;
- organization_audit_policy.

Nao deve:
- ser tratado como simples tag;
- ser implementado apenas no frontend;
- depender de convencao informal.

Decisao:
- multi-tenant real e direcao arquitetural obrigatoria, mas deve ser introduzido incrementalmente.

---

### 3.3 Property Operating System

Responsabilidade:
- representar o imovel como ativo tecnico;
- concentrar memoria tecnica, ambientes, inventario, documentos, manutencao e historico;
- servir como eixo operacional para OS, credenciais, evidencias e timeline.

Entidades atuais relacionadas:
- properties;
- rooms;
- inventory;
- documents;
- maintenance;
- expenses;
- timeline.

Contratos atuais relacionados:
- `/api/v1/properties/*`;
- paginas em `src/app/(app)/properties/*`.

Nao deve:
- virar apenas cadastro simples de imovel;
- permitir acesso amplo sem contexto;
- misturar provider discovery com dado patrimonial.

Decisao:
- propriedade e o nucleo do produto atual e deve migrar para pertencimento organizacional.

---

### 3.4 Service Operations

Responsabilidade:
- controlar ordens de servico;
- organizar solicitacao, aprovacao, execucao, mensagens, fotos, anexos, bids e status;
- manter rastreabilidade operacional.

Entidades atuais relacionadas:
- serviceOrders;
- serviceRequests;
- serviceBids;
- messages;
- attachments;
- audit links;
- share links.

Contratos atuais relacionados:
- `/api/v1/services/*`;
- `/api/v1/properties/:propertyId/services/*`;
- componentes em `src/components/services/*`.

Nao deve:
- abrir fluxo falso sem backend real;
- expor OS por link publico sem escopo, expiracao e auditoria;
- tratar provider como participante amplo sem atribuicao ou elegibilidade.

Decisao:
- OS e unidade operacional central e deve ser auditavel por padrao.

---

### 3.5 Provider Network

Responsabilidade:
- representar prestadores homologados;
- controlar elegibilidade, perfil profissional, categorias, oportunidades e atribuicoes;
- preservar rede privada, curada e governada.

Entidades atuais relacionadas:
- provider profile;
- provider opportunities;
- marketplace routes;
- bids;
- provider services.

Contratos atuais relacionados:
- `/api/v1/provider/*`;
- `/api/v1/marketplace/*`;
- paginas em `src/app/provider/*`.

Nao deve:
- ser tratado como marketplace aberto;
- listar prestadores de forma publica e ampla;
- permitir competicao por preco como tese central;
- usar linguagem de rede aberta quando o fluxo for privado.

Decisao:
- marketplace e naming legado ou transicional; a direcao oficial e provider network curada.

---

### 3.6 Credentials and Sensitive Access

Responsabilidade:
- proteger credenciais do imovel;
- controlar revelacao explicita;
- auditar leitura, copia, compartilhamento, rotacao e revogacao;
- preparar criptografia futura.

Entidades atuais relacionadas:
- propertyAccessCredentials;
- service share links com credenciais;
- audit log.

Contratos atuais relacionados:
- `/api/v1/properties/:propertyId/credentials/*`.

Nao deve:
- retornar segredo em listagem padrao;
- tratar segredo como texto comum de UI;
- compartilhar credenciais sem escopo claro;
- registrar segredo em audit log.

Decisao:
- credenciais sao segredos auditaveis;
- DTO padrao deve omitir `secret`;
- revelacao deve ser explicita e registrada.

---

### 3.7 Audit and Governance

Responsabilidade:
- registrar eventos sensiveis;
- apoiar revisao operacional;
- permitir investigacao de acesso e alteracoes;
- sustentar governanca premium.

Entidades atuais relacionadas:
- auditLog;
- auditLinks;
- eventos de auth, OS, documentos, credenciais e arquivos.

Nao deve:
- armazenar segredo, token sensivel ou payload excessivo;
- ser opcional em operacoes sensiveis;
- ser apenas log tecnico.

Decisao:
- auditoria deve evoluir de helper pontual para fronteira transversal.

---

### 3.8 Documents and Evidence

Responsabilidade:
- armazenar documentos do imovel;
- tratar anexos, fotos, videos, recibos, laudos e evidencias;
- controlar classificacao, acesso e lifecycle.

Entidades atuais relacionadas:
- documents;
- R2 storage;
- service photos;
- inventory photos.

Nao deve:
- depender de URL publica permanente como padrao;
- misturar documento patrimonial com evidencia operacional sem metadata;
- gravar arquivo sem contexto de propriedade e ator.

Decisao:
- arquivos devem evoluir para acesso governado e auditavel.

---

### 3.9 Frontend Product Shell

Responsabilidade:
- fornecer layout comum;
- aplicar The Architectural Lens;
- organizar navegacao por papel;
- preservar experiencia mobile-first e premium.

Componentes atuais relacionados:
- AppShell;
- TopNav;
- BottomNav;
- componentes UI base;
- tokens em globals/tokens.

Nao deve:
- criar mini design systems por pagina;
- usar linguagem visual conflitante;
- introduzir aliases visuais novos sem decisao;
- parecer dashboard generico.

Decisao:
- The Architectural Lens e sistema visual unico;
- componentes base devem concentrar estilo reutilizavel.

---

## 4. Fluxo de decisao entre fronteiras

Quando uma mudanca toca mais de uma fronteira, seguir a ordem:

1. definir ownership do dominio;
2. validar contrato de API;
3. validar autorizacao contextual;
4. validar eventos auditaveis;
5. validar impacto no frontend;
6. implementar de forma incremental.

---

## 5. Regras para o Codex

O Codex deve:
- identificar a fronteira afetada antes de editar;
- evitar mudar varias fronteiras sem necessidade;
- explicar impactos quando uma mudanca atravessa fronteiras;
- preservar contratos reais;
- evitar invencao de endpoint ou entidade.

O Codex nao deve:
- tratar provider network como marketplace aberto;
- expor dados sensiveis em DTO padrao;
- refatorar auth, schema e UI juntos sem pedido explicito;
- criar UI sem fluxo real no backend.

---

## 6. Matriz de sensibilidade

| Fronteira | Sensibilidade | Exige auditoria | Exige autorizacao contextual |
| --- | --- | --- | --- |
| Identity and Access | Alta | Sim | Sim |
| Organization and Tenant | Alta | Sim | Sim |
| Property Operating System | Alta | Sim | Sim |
| Service Operations | Alta | Sim | Sim |
| Provider Network | Media/Alta | Sim | Sim |
| Credentials and Sensitive Access | Critica | Sim | Sim |
| Audit and Governance | Critica | Sim | Sim |
| Documents and Evidence | Alta | Sim | Sim |
| Frontend Product Shell | Media | Nao por padrao | Indireta |

---

## 7. Criterio de aceite de novas fronteiras

Uma nova fronteira so deve ser criada se:
- tiver responsabilidade distinta;
- reduzir acoplamento;
- melhorar seguranca ou governanca;
- representar dominio real do produto;
- nao duplicar uma fronteira existente.


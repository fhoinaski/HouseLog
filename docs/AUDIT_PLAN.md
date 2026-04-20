# AUDIT_PLAN.md — HouseLog

## 1. Objetivo

Este documento define o plano oficial de auditoria do HouseLog para consolidar o sistema como uma plataforma privada, segura e escalável de gestão técnica e operacional de imóveis premium.

A auditoria deve cobrir:

- produto;
- arquitetura;
- backend;
- frontend;
- segurança;
- governança;
- rede homologada;
- prontidão comercial.

---

## 2. Eixos de auditoria

A auditoria será dividida em 6 frentes:

1. estratégia e escopo
2. modelo de domínio e dados
3. backend e contratos
4. frontend e experiência
5. segurança e governança
6. operação e venda

---

## 3. Auditoria 1 — Estratégia e escopo

### Perguntas
- o produto está claramente posicionado?
- o ICP está claro?
- o HouseLog está sendo tratado como sistema privado ou marketplace?
- o escopo está coerente com a tese premium?
- existe excesso de funcionalidades desconectadas?
- o provider model reforça confiança ou aproxima o sistema de uma rede aberta?

### Itens a validar
- alinhamento com `PRODUCT_STRATEGY.md`
- clareza de proposta de valor
- definição do núcleo do produto
- definição do que é módulo secundário
- alinhamento entre produto e arquitetura

### Saída esperada
- riscos estratégicos identificados
- itens a remover, congelar ou priorizar
- tese final consolidada

---

## 4. Auditoria 2 — Modelo de domínio e dados

### Perguntas
- existe multi-tenant real?
- existe separação clara entre tenant, organization e property?
- o modelo de papéis é suficiente?
- o provider model está pronto para rede homologada?
- há governança para credenciais, auditoria e acessos?
- o modelo atual escala sem ambiguidade?

### Itens a validar
- schema atual
- entidades estratégicas
- ownership dos dados
- relacionamentos
- risco de acoplamento excessivo
- capacidade de evolução incremental

### Saída esperada
- mapa do domínio atual
- limitações do domínio atual
- modelo-alvo sugerido
- ordem de refatoração

---

## 5. Auditoria 3 — Backend e contratos

### Perguntas
- as rotas estão organizadas por domínio?
- os contratos são consistentes?
- a autorização está centralizada ou espalhada?
- existem endpoints públicos com risco elevado?
- há risco de acoplamento e regressão?
- a API está pronta para crescer mantendo segurança e previsibilidade?

### Itens a validar
- `apps/api/src/index.ts`
- `apps/api/src/routes/*`
- `apps/api/src/middleware/*`
- `apps/api/src/lib/*`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/migrations/*`

### Critérios
- clareza de contratos
- previsibilidade de resposta
- validação de entrada
- separação de responsabilidades
- segurança de endpoints públicos
- compatibilidade com multi-tenant futuro

### Saída esperada
- pontos fortes
- problemas críticos
- problemas importantes
- arquitetura-alvo sugerida
- plano de refatoração por etapas

---

## 6. Auditoria 4 — Frontend e experiência

### Perguntas
- o frontend reflete o posicionamento premium e privado?
- o shell do sistema está consolidado?
- o design system é único e consistente?
- a experiência do provider parece rede curada ou marketplace aberto?
- a UX por papel é clara?
- existe consistência visual e estrutural?

### Itens a validar
- layout
- navegação
- tokens
- componentes base
- páginas críticas
- fluxo por papel
- coerência visual

### Arquivos prioritários
- `src/app/*`
- `src/components/*`
- `src/components/ui/*`
- `src/components/navigation/*`
- `src/app/globals.css`
- `src/app/tokens.css`
- `src/lib/api.ts`

### Saída esperada
- inconsistências de shell
- inconsistências de design system
- componentes a consolidar
- roadmap de refatoração visual e estrutural

---

## 7. Auditoria 5 — Segurança e governança

### Perguntas
- segredos e credenciais estão protegidos adequadamente?
- existem links públicos com escopo controlado?
- há trilha de auditoria suficiente?
- o armazenamento de tokens está adequado?
- existe segregação real de acesso?
- o sistema está pronto para lidar com imóveis e clientes premium?

### Itens a validar
- autenticação
- autorização
- storage de token
- credenciais
- links públicos
- anexos
- logs
- eventos de acesso
- expiração e revogação

### Saída esperada
- riscos críticos
- riscos altos
- riscos médios
- plano de endurecimento
- prioridades de implementação

---

## 8. Auditoria 6 — Operação e venda

### Perguntas
- o produto está vendável com clareza?
- o onboarding faz sentido?
- a rede homologada pode ser operada?
- há definição de responsabilidade entre plataforma, cliente e prestador?
- o discurso comercial está alinhado com o produto real?

### Itens a validar
- ICP
- proposta de valor
- processo de onboarding
- modelo operacional da rede
- narrativa comercial
- risco jurídico e de reputação

### Saída esperada
- pontos de venda
- gargalos operacionais
- riscos comerciais
- recomendações de posicionamento

---

## 9. Priorização de severidade

### Crítico
Afeta:
- segurança
- isolamento de clientes
- credenciais
- autorização
- integridade do domínio

### Alto
Afeta:
- escalabilidade
- governança
- clareza de produto
- experiência premium

### Médio
Afeta:
- manutenção
- consistência
- UX
- eficiência operacional

### Baixo
Afeta:
- refinamento
- legibilidade
- acabamento

---

## 10. Ordem sugerida da auditoria

1. estratégia e escopo
2. modelo de domínio
3. backend
4. segurança
5. frontend
6. operação/venda

---

## 11. Entregáveis obrigatórios por auditoria

Toda auditoria deve gerar:

1. diagnóstico
2. problemas críticos
3. problemas importantes
4. pontos fortes
5. proposta de correção
6. plano por fases
7. riscos de regressão
8. checklist de validação manual

---

## 12. Critério de conclusão da auditoria

A auditoria estará concluída quando houver:

- visão clara do estado atual;
- visão clara do estado-alvo;
- priorização objetiva;
- ordem de implementação;
- riscos mapeados;
- base para execução com Codex e revisão humana.
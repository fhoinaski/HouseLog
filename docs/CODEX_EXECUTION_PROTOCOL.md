# CODEX_EXECUTION_PROTOCOL.md — HouseLog

## 1. Objetivo

Este documento define o protocolo oficial para usar o Codex na evolução do HouseLog.

O Codex deve ser tratado como braço operacional de implementação e refatoração, nunca como fonte autônoma de estratégia ou de invenção de domínio.

A direção do projeto vem de:
- `PRODUCT_STRATEGY.md`
- `ARCHITECTURE_TARGET.md`
- `AUDIT_PLAN.md`
- `PROVIDER_NETWORK_MODEL.md`
- `SECURITY_REVIEW.md`
- `AGENTS.md` do repositório

---

## 2. Regra principal

O Codex nunca deve receber pedidos amplos e vagos como:
- “refatore tudo”
- “melhore a arquitetura”
- “deixe profissional”
- “arrume o projeto inteiro”

O Codex deve sempre operar por etapas pequenas, com escopo claro, arquivos definidos e restrições explícitas.

---

## 3. Fluxo obrigatório de execução

Toda execução com Codex deve seguir este fluxo:

1. diagnóstico dos arquivos envolvidos
2. descrição objetiva do problema
3. proposta de solução
4. implementação controlada
5. lista de arquivos alterados
6. riscos
7. validações manuais

---

## 4. Estrutura obrigatória do prompt

Todo prompt para o Codex deve conter:

### Contexto
- o que é o HouseLog
- qual é a tese do produto
- qual é o módulo afetado

### Objetivo
- qual problema será resolvido nesta etapa

### Arquivos-alvo
- quais arquivos devem ser analisados ou alterados

### Restrições
- o que não pode ser quebrado
- o que não pode ser inventado
- o que deve ser preservado

### Entregáveis
- exatamente o que o Codex deve devolver

---

## 5. Regras obrigatórias para o Codex

O Codex deve:
- respeitar os AGENTS.md;
- respeitar o posicionamento premium privado;
- respeitar o domínio real do HouseLog;
- trabalhar de forma incremental;
- preservar contratos quando possível;
- explicitar impactos;
- manter código limpo e revisável.

O Codex não deve:
- inventar endpoint;
- inventar entidade sem aderência ao domínio;
- criar refatoração destrutiva sem aviso;
- alterar contratos silenciosamente;
- usar `any` sem necessidade real;
- expandir escopo;
- aproximar o produto de marketplace aberto genérico.

---

## 6. Tipos de tarefa permitidos

### Tipo A — Auditoria
Exemplo:
- auditar backend
- auditar frontend
- auditar segurança
- auditar schema

### Tipo B — Refatoração controlada
Exemplo:
- introduzir tenant_id
- consolidar permission checks
- criar audit log
- endurecer storage de credenciais
- reorganizar componentes base

### Tipo C — Criação documental
Exemplo:
- criar documento de arquitetura
- criar documento de segurança
- criar ADR
- criar checklist

### Tipo D — Ajuste de UX/UI
Exemplo:
- consolidar layout shell
- padronizar cards
- refatorar provider experience
- alinhar design system

---

## 7. Formato de saída esperado

Toda resposta do Codex deve conter:

1. diagnóstico
2. plano
3. implementação
4. arquivos alterados
5. riscos
6. validações manuais

Se a tarefa for documental:
1. objetivo
2. lista de arquivos criados/alterados
3. conteúdo completo
4. próximos passos

---

## 8. Estratégia de execução incremental

A ordem padrão de execução deve ser:

1. documentos-base
2. auditoria do domínio
3. auditoria do backend
4. auditoria do frontend
5. multi-tenant
6. provider network curada
7. auditoria e governança
8. segurança de credenciais e acessos
9. refino de UX premium
10. preparação comercial

---

## 9. Escopo máximo por prompt

Cada prompt deve focar em:

- 1 problema central
ou
- 1 domínio específico
ou
- 1 etapa de refatoração

Evitar prompts que mudem:
- backend inteiro;
- frontend inteiro;
- auth + schema + UI + rotas + docs ao mesmo tempo.

---

## 10. Regra de segurança para mudanças

Antes de aceitar qualquer mudança, validar:

- há impacto em contratos?
- há impacto em auth?
- há impacto em rotas públicas?
- há impacto em dados sensíveis?
- há impacto em isolamento entre clientes?
- há impacto em UX crítica?

Se sim, a mudança deve ser dividida em subetapas menores.

---

## 11. Modelo de prompt base

Usar este formato:

Contexto:
- HouseLog é uma plataforma privada de gestão técnica, manutenção e confiança para imóveis premium.
- Não trate o produto como marketplace aberto.
- Preserve aderência aos AGENTS.md e aos documentos de estratégia e arquitetura.

Objetivo:
- [descrever a meta da etapa]

Arquivos-alvo:
- [listar arquivos]

Restrições:
- não inventar endpoints
- não inventar domínio
- não quebrar contratos silenciosamente
- manter tipagem forte
- explicar riscos
- trabalhar de forma incremental

Entregue:
1. diagnóstico
2. plano
3. implementação
4. arquivos alterados
5. riscos
6. validações manuais

---

## 12. Critério de aceite de uma execução com Codex

Uma execução é aceitável apenas se:
- o escopo foi respeitado;
- não houve invenção de domínio;
- os riscos foram explicitados;
- a mudança é revisável;
- a mudança respeita o posicionamento premium e privado do HouseLog.
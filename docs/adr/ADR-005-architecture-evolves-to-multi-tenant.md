# ADR-005 - Arquitetura evolui para multi-tenant real

## Status

Aceito.

## Contexto

O modelo atual do HouseLog funciona principalmente por usuario, propriedade e role global. Essa base e suficiente para o produto funcional inicial, mas limitada para construtoras, administradoras e portfolios privados.

O publico-alvo premium exige isolamento, governanca, auditoria e controle por organizacao.

## Decisao

O HouseLog evoluira para arquitetura multi-tenant real.

A direcao-alvo inclui:
- organizations;
- organization_memberships;
- property_memberships;
- provider_network_memberships;
- provider_scopes;
- audit_events com contexto organizacional;
- credenciais e documentos com politica de acesso.

A migracao deve ser incremental, preservando contratos e dados atuais sempre que possivel.

## Consequencias

### Positivas
- prepara escala B2B;
- permite clientes institucionais;
- melhora isolamento de dados;
- reduz ambiguidade de acesso;
- melhora auditoria e governanca.

### Custos
- schema precisara de migracoes graduais;
- authorization checks devem ser centralizados;
- frontend precisara de contexto organizacional;
- backfill de dados existentes sera necessario;
- contratos antigos podem precisar de periodo de compatibilidade.

## Impacto no codigo atual

Nao exige introducao imediata de tenant em todas as tabelas.

Ordem recomendada:
1. documentar decisoes e boundaries;
2. introduzir organizations e memberships de forma compat;
3. adicionar organization_id nullable onde necessario;
4. backfill para dados existentes;
5. centralizar autorizacao;
6. migrar provider network;
7. endurecer auditoria e credenciais;
8. remover fallbacks antigos apenas apos validacao.

## Regra para o Codex

O Codex deve tratar multi-tenant como direcao obrigatoria, mas nunca deve fazer migracao destrutiva ou transversal sem plano, backfill e checklist manual.


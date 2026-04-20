# ACTION_ENDPOINTS_CANDIDATES.md - HouseLog

## 1. Objetivo

Este documento mapeia os principais candidatos a action endpoints explicitos no HouseLog.

Action endpoint, neste contexto, e uma rota que representa uma acao de dominio com semantica operacional clara, em vez de depender apenas de CRUD generico. O objetivo e melhorar clareza, autorizacao, auditoria e preparacao AI-ready sem criar camada de IA prematura.

Este documento nao cria endpoints automaticamente. Ele orienta futuras implementacoes incrementais.

Referencias:

- `docs/IMPLEMENTATION_ROADMAP.md`
- `docs/BOUNDARY_MAP.md`
- `docs/SECURITY_REVIEW.md`
- `docs/CREDENTIAL_ACCESS_POLICY.md`
- `docs/AI_READY_CHECKLIST.md`
- `docs/adr/ADR-001-private-platform-not-marketplace.md`
- `docs/adr/ADR-003-provider-network-curated.md`
- `docs/adr/ADR-004-credentials-are-auditable-secrets.md`
- `docs/adr/ADR-005-architecture-evolves-to-multi-tenant.md`
- `house-log-back/apps/api/src/lib/authorization.ts`

---

## 2. Diagnostico

O HouseLog ja possui operacoes que sao mais ricas do que criar, editar ou deletar registros. Revelar credencial, gerar acesso temporario, concluir manutencao, fechar OS com evidencia, criar link auditavel e acionar provider elegivel sao exemplos de decisoes operacionais.

Quando essas operacoes ficam escondidas em CRUD generico, o sistema perde:

- semantica de produto;
- pontos claros de autorizacao;
- auditoria consistente;
- contratos mais legiveis para frontend e operacao;
- base segura para automacao futura.

Action endpoints devem ser adotados apenas quando houver valor real de dominio hoje.

---

## 3. Criterios de classificacao

### Prioridade

- **P0**: acao sensivel ou critica ja existente, com impacto direto em seguranca, auditoria ou governanca.
- **P1**: acao operacional importante, com ganho claro de semantica, UX ou rastreabilidade.
- **P2**: acao util para evolucao do produto e AI-ready, mas dependente de maturidade de dominio.

### Risco

- **Alto**: envolve segredo, link publico, provider, permissao, status critico ou exposicao externa.
- **Medio**: altera estado operacional relevante ou metadados que afetam governanca.
- **Baixo**: organiza processamento auxiliar, sem mudar permissao ou fluxo sensivel.

### Beneficio

- **Alto**: melhora seguranca, auditabilidade, autorizacao ou clareza operacional.
- **Medio**: melhora manutencao, UX e semantica.
- **Baixo**: melhora incremental sem desbloquear fluxo importante.

---

## 4. Lista priorizada

| Prioridade | Candidato | Boundary principal | Risco | Beneficio | Status recomendado |
| --- | --- | --- | --- | --- | --- |
| P0 | `revealCredentialSecret` | Credentials and Sensitive Access | Alto | Alto | manter como action endpoint e remover legado `GET` depois |
| P0 | `generateTemporaryCredentialAccess` | Credentials and Sensitive Access | Alto | Alto | formalizar auditoria e policy granular |
| P0 | `createAuditLink` | Audit and Governance / Service Operations | Alto | Alto | manter action endpoint com Authorization Core |
| P1 | `closeServiceOrderWithEvidence` | Service Operations / Documents and Evidence | Alto | Alto | introduzir quando fechamento exigir evidencia formal |
| P1 | `assignEligibleProvider` | Provider Network / Service Operations | Alto | Alto | introduzir com elegibilidade real |
| P1 | `markMaintenanceDone` | Property Operating System | Medio | Alto | explicitar conclusao preventiva |
| P1 | `requestProviderProposal` | Provider Network / Service Operations | Medio/Alto | Alto | substituir semantica de marketplace por rede elegivel |
| P1 | `extractDocumentMetadata` | Documents and Evidence | Medio | Medio/Alto | separar processamento de upload |
| P2 | `classifyDocument` | Documents and Evidence | Medio | Medio | evoluir apos metadata e taxonomia ficarem estaveis |
| P2 | `createServiceOrderDraft` | Service Operations | Medio | Medio | util quando houver fluxo real de rascunho |

---

## 5. Candidatos detalhados

### 5.1 `revealCredentialSecret`

- **Prioridade**: P0
- **Boundary**: Credentials and Sensitive Access
- **Operacao atual relacionada**: revelacao explicita de segredo de credencial.
- **Motivo para action endpoint**: revelar segredo e uma acao sensivel e auditavel, nao uma leitura comum.
- **Contrato recomendado**: `POST /properties/:propertyId/credentials/:credId/secret/reveal`
- **Autorizacao esperada**: `canRevealCredentialSecret`
- **Auditoria esperada**: obrigatoria, action `secret_reveal`, sem registrar valor do segredo.
- **Risco**: alto, por exposicao de credencial.
- **Beneficio**: alto, porque corrige semantica HTTP, melhora governanca e prepara policy granular.
- **Observacao**: o `GET /secret` legado deve permanecer apenas durante janela de compatibilidade.

### 5.2 `generateTemporaryCredentialAccess`

- **Prioridade**: P0
- **Boundary**: Credentials and Sensitive Access
- **Operacao atual relacionada**: geracao de codigo temporario para credencial com integracao, como fechadura Intelbras.
- **Motivo para action endpoint**: gerar acesso temporario e uma acao operacional com prazo, risco e possivel impacto fisico.
- **Contrato recomendado**: manter semantica de `POST /properties/:propertyId/credentials/:credId/generate-temp-code` ou evoluir para `/temporary-access`
- **Autorizacao esperada**: `canGenerateTemporaryCredentialAccess`, com futura `CredentialAccessPolicy`.
- **Auditoria esperada**: obrigatoria, registrando credencial, propriedade, prazo e ator, sem segredo bruto.
- **Risco**: alto, por criar acesso temporario ao imovel.
- **Beneficio**: alto, porque deixa acesso fisico rastreavel e governado.
- **Observacao**: deve exigir contexto/motivo em etapa futura.

### 5.3 `createAuditLink`

- **Prioridade**: P0
- **Boundary**: Audit and Governance / Service Operations / Public Access Boundary
- **Operacao atual relacionada**: criacao de link publico auditavel para acompanhamento ou evidencia de OS.
- **Motivo para action endpoint**: link publico nao e apenas criacao de registro; e concessao temporaria de acesso externo.
- **Contrato recomendado**: action explicita de criacao de link, preservando escopo e expiracao.
- **Autorizacao esperada**: `canCreateAuditLink`
- **Auditoria esperada**: obrigatoria, com property, service order, escopo, expiracao e ator.
- **Risco**: alto, por expor recurso fora da sessao autenticada.
- **Beneficio**: alto, porque reduz risco de public link amplo e melhora governanca.
- **Observacao**: deve continuar expondo dados minimos.

### 5.4 `closeServiceOrderWithEvidence`

- **Prioridade**: P1
- **Boundary**: Service Operations / Documents and Evidence / Audit and Governance
- **Operacao atual relacionada**: conclusao/fechamento de OS, fotos finais, checklist, custo e verificacao.
- **Motivo para action endpoint**: fechar OS com evidencia e uma decisao operacional, nao simples update de status.
- **Contrato recomendado**: `POST /services/:serviceId/close-with-evidence` ou rota contextual por propriedade quando o modelo estiver consolidado.
- **Autorizacao esperada**: futuro `canMutateServiceOrder` ou `canCloseServiceOrder`
- **Auditoria esperada**: obrigatoria, com status anterior, status novo, evidencias anexadas e ator.
- **Risco**: alto, porque altera estado final e pode afetar historico tecnico/financeiro.
- **Beneficio**: alto, porque reforca prontuario tecnico e confianca operacional.
- **Observacao**: nao deve ser criado antes de validar o fluxo atual de fechamento e evidencias.

### 5.5 `assignEligibleProvider`

- **Prioridade**: P1
- **Boundary**: Provider Network / Service Operations
- **Operacao atual relacionada**: atribuicao de provider a OS ou oportunidade.
- **Motivo para action endpoint**: atribuir provider deve validar elegibilidade, homologacao, contexto e disponibilidade, nao apenas editar `assigned_to`.
- **Contrato recomendado**: `POST /services/:serviceId/provider/assign` com provider alvo e motivo/contexto.
- **Autorizacao esperada**: futuro `canAssignProvider` combinado com elegibilidade de rede homologada.
- **Auditoria esperada**: obrigatoria, com provider, service order, regra de elegibilidade aplicada e ator.
- **Risco**: alto, por conceder visibilidade operacional ao provider.
- **Beneficio**: alto, porque distancia o produto de marketplace aberto e reforca rede curada.
- **Observacao**: depende de modelo mais claro de provider eligibility.

### 5.6 `markMaintenanceDone`

- **Prioridade**: P1
- **Boundary**: Property Operating System / Audit and Governance
- **Operacao atual relacionada**: conclusao de item de manutencao preventiva.
- **Motivo para action endpoint**: marcar manutencao como feita atualiza saude tecnica, historico e governanca preventiva.
- **Contrato recomendado**: `POST /properties/:propertyId/maintenance/:maintenanceId/mark-done`
- **Autorizacao esperada**: futuro `canManageMaintenance` ou helper contextual por propriedade.
- **Auditoria esperada**: recomendada, com data, responsavel, evidencia opcional e proxima recorrencia.
- **Risco**: medio, por alterar historico preventivo.
- **Beneficio**: alto, porque reforca o imovel como prontuario tecnico.
- **Observacao**: deve preservar criacao/edicao existentes enquanto a action e adotada.

### 5.7 `requestProviderProposal`

- **Prioridade**: P1
- **Boundary**: Provider Network / Service Operations
- **Operacao atual relacionada**: solicitacao de proposta/orcamento a provider elegivel.
- **Motivo para action endpoint**: pedir proposta e uma acao de rede privada, nao simples criacao aberta de bid.
- **Contrato recomendado**: `POST /services/:serviceId/provider-proposals/request`
- **Autorizacao esperada**: futuro `canRequestProviderProposal` e elegibilidade por provider/category/property.
- **Auditoria esperada**: recomendada/obrigatoria conforme impacto comercial.
- **Risco**: medio/alto, por envolver provider, escopo de OS e possivel notificacao externa.
- **Beneficio**: alto, porque alinha provider flow a rede homologada.
- **Observacao**: nao deve reintroduzir linguagem ou comportamento de marketplace aberto.

### 5.8 `extractDocumentMetadata`

- **Prioridade**: P1
- **Boundary**: Documents and Evidence / Property Operating System
- **Operacao atual relacionada**: OCR e extracao de dados de documentos.
- **Motivo para action endpoint**: extrair metadata e processamento rastreavel sobre acervo tecnico, separado de upload.
- **Contrato recomendado**: `POST /properties/:propertyId/documents/:documentId/extract-metadata`
- **Autorizacao esperada**: helper contextual de acesso ao documento/propriedade.
- **Auditoria esperada**: recomendada, registrando processamento e ator/sistema, sem expor conteudo sensivel desnecessario.
- **Risco**: medio, por envolver documento potencialmente sensivel.
- **Beneficio**: medio/alto, porque melhora qualidade de dados para busca, timeline e AI-ready.
- **Observacao**: deve ser idempotente ou ter controle claro de reprocessamento.

### 5.9 `classifyDocument`

- **Prioridade**: P2
- **Boundary**: Documents and Evidence / Property Operating System
- **Operacao atual relacionada**: classificacao de documento por tipo, finalidade ou area tecnica.
- **Motivo para action endpoint**: classificacao altera semantica do acervo tecnico e deve ser rastreavel.
- **Contrato recomendado**: `POST /properties/:propertyId/documents/:documentId/classify`
- **Autorizacao esperada**: helper contextual de acesso ao documento/propriedade.
- **Auditoria esperada**: recomendada quando a classificacao afetar workflow, validade ou visibilidade.
- **Risco**: medio, por risco de classificacao incorreta virar fonte oficial.
- **Beneficio**: medio, porque melhora organizacao e automacao futura.
- **Observacao**: depende de taxonomia estavel de documentos; sugestoes automaticas devem ser revisaveis.

### 5.10 `createServiceOrderDraft`

- **Prioridade**: P2
- **Boundary**: Service Operations / Property Operating System
- **Operacao atual relacionada**: abertura de OS ou solicitacao antes de envio final.
- **Motivo para action endpoint**: rascunho de OS pode capturar contexto, evidencias e dados incompletos sem disparar fluxo operacional.
- **Contrato recomendado**: `POST /properties/:propertyId/services/drafts`
- **Autorizacao esperada**: futuro `canCreateServiceOrderDraft` ou `canCreateServiceOrder`.
- **Auditoria esperada**: nao obrigatoria para rascunho simples; recomendada quando envolver anexos sensiveis ou origem externa.
- **Risco**: medio, por criar estado intermediario que pode aumentar complexidade.
- **Beneficio**: medio, especialmente para mobile em campo e futuras assistencias.
- **Observacao**: so deve ser criado quando houver UX real de rascunho; nao criar entidade vazia antecipada.

---

## 6. Regras para criar action endpoints

Antes de implementar qualquer candidato:

1. confirmar que a acao existe no produto atual ou no roadmap imediato;
2. identificar boundary principal e secundarios;
3. definir helper de autorizacao antes da rota;
4. definir se exige auditoria;
5. definir payload minimo e tipado;
6. preservar compatibilidade com endpoints existentes quando necessario;
7. evitar duplicar comportamento CRUD sem ganho de dominio;
8. atualizar frontend, policy e docs quando a action virar contrato publico.

---

## 7. Anti-patterns

Nao criar action endpoint quando:

- a acao e apenas update simples sem semantica operacional;
- nao existe UI, job ou fluxo real que use a acao;
- o endpoint so existe para "parecer AI-ready";
- a autorizacao seria copiada ad hoc dentro da rota;
- a acao exporia segredo, documento ou provider sem policy;
- o nome da acao mascara um fluxo de marketplace aberto;
- a action cria estado intermediario que o produto nao consegue explicar.

---

## 8. Proximos passos recomendados

1. Manter `revealCredentialSecret` como referencia de action endpoint sensivel e concluir a remocao futura do `GET` legado.
2. Adicionar auditoria formal a `generateTemporaryCredentialAccess`.
3. Revisar `createAuditLink` como referencia de Public Access Boundary.
4. Definir helpers do Authorization Core para service order e maintenance antes de novas actions.
5. Escolher um candidato P1 por vez, preferencialmente `markMaintenanceDone` ou `closeServiceOrderWithEvidence`, conforme maturidade do fluxo atual.
6. Revisar este documento sempre que um candidato virar contrato implementado.


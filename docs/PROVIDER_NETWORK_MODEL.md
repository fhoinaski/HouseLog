# PROVIDER_NETWORK_MODEL.md — HouseLog

## 1. Objetivo

Este documento define o modelo-alvo da rede de prestadores do HouseLog.

A rede de prestadores do HouseLog deve ser:

- privada;
- curada;
- homologada;
- orientada à confiança;
- controlada por tenant/organização;
- incompatível com a lógica de marketplace aberto massificado.

---

## 2. Princípio central

No HouseLog, provider não é apenas “usuário que presta serviço”.
Provider é um agente operacional validado dentro de uma rede de confiança.

O sistema deve permitir:

- cadastro estruturado;
- avaliação;
- homologação;
- classificação;
- vínculo por tenant;
- preferência por categoria/região;
- bloqueio;
- histórico;
- governança.

---

## 3. O que a rede não deve ser

A rede do HouseLog não deve funcionar como:

- plataforma aberta de cadastro livre;
- ranking público irrestrito;
- leilão de preço;
- disputa massificada;
- rede sem curadoria.

---

## 4. Estrutura conceitual

## 4.1 Provider
Entidade principal do prestador.

Dados:
- identidade;
- contatos;
- categorias;
- região;
- disponibilidade;
- perfil profissional;
- reputação consolidada.

## 4.2 ProviderProfile
Perfil estruturado:
- bio;
- especialidades;
- formações;
- certificações;
- portfólio;
- casos antes/depois;
- histórico relevante.

## 4.3 ProviderApproval
Relação entre provider e tenant.

Campos conceituais:
- provider_id
- tenant_id
- organization_id opcional
- approval_status
- approval_level
- reviewed_by
- reviewed_at
- notes

### Status sugeridos
- pending_review
- approved
- preferred
- backup
- blocked
- archived

## 4.4 ProviderCoverageArea
Regiões atendidas.

## 4.5 ProviderCapability
Capacidades técnicas e categorias.

## 4.6 PreferredProviderLink
Vínculo preferencial entre provider e:
- tenant
- organization
- property
- categoria
- região

---

## 5. Modelo de confiança

A confiança no provider deve ser formada por:

- homologação formal;
- histórico de execução;
- avaliações;
- endossos;
- consistência operacional;
- pontualidade;
- qualidade percebida;
- alinhamento com o padrão premium do cliente.

---

## 6. Níveis recomendados de provider

### Level 1 — Approved
Prestador aprovado para operar no tenant.

### Level 2 — Preferred
Prestador preferencial para categorias ou contextos.

### Level 3 — Strategic
Prestador altamente confiável e recorrente.

### Level 4 — Backup
Prestador disponível, mas não prioritário.

### Blocked
Prestador impedido de operar naquele tenant.

---

## 7. Regras operacionais da rede

### Regra 1
Nenhum provider deve acessar oportunidades fora do escopo permitido.

### Regra 2
Provider só deve receber demanda se:
- estiver homologado;
- estiver no escopo do tenant;
- atender categoria/região;
- estiver apto para aquele fluxo.

### Regra 3
O sistema deve permitir rede privada por tenant.
Um provider pode:
- estar aprovado em um tenant;
- bloqueado em outro;
- preferencial em um terceiro.

### Regra 4
Provider não deve ter lógica de exposição pública massificada por padrão.

---

## 8. Bid model recomendado

Bids devem ser tratados como ferramenta controlada, não como pregão aberto.

### Diretrizes
- limitar quem pode cotar;
- priorizar providers homologados;
- permitir escolha por qualidade e histórico, não apenas preço;
- registrar justificativas de aceite/rejeição;
- preservar trilha de decisão.

---

## 9. Avaliação e reputação

A reputação deve ser composta por:

- notas;
- avaliações qualitativas;
- endossos;
- histórico de recorrência;
- indicadores de execução;
- feedback por tenant.

### Importante
Reputação do HouseLog deve ser:
- contextual;
- auditável;
- confiável;
- menos aberta e mais útil.

---

## 10. Riscos a evitar

- transformar provider em marketplace público;
- abrir cadastro sem curadoria;
- usar só preço como métrica;
- misturar provider aprovado e desconhecido no mesmo fluxo;
- expor ranking público inadequado;
- permitir acesso sem vínculo contextual.

---

## 11. Funcionalidades recomendadas

### Curto prazo
- provider profile estruturado
- provider approval por tenant
- preferred providers
- bloqueio por tenant
- filtro por categoria e região

### Médio prazo
- score operacional por tenant
- classificação por padrão de execução
- SLA histórico
- recomendação contextual

### Longo prazo
- roteamento inteligente
- matching avançado
- analytics de performance
- automação de elegibilidade

---

## 12. Critério de alinhamento

Qualquer evolução da rede de providers só está correta se:

- aumenta confiança;
- aumenta governança;
- melhora aderência ao padrão premium;
- evita massificação;
- reforça a operação privada;
- preserva reputação contextual.
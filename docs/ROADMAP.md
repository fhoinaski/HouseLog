# Roadmap do HouseLog

## Visao de produto

O HouseLog e uma plataforma SaaS privada para governanca tecnica e operacional de imoveis premium. O produto organiza ordens de servico, manutencao, documentos, garantias, reformas, inventario, handover e historico tecnico em um prontuario digital confiavel do imovel.

O foco nao e volume generico de chamados. O foco e confianca, rastreabilidade, seguranca, memoria tecnica e experiencia premium para proprietarios, administradoras, construtoras, family offices, engenheiros, arquitetos e prestadores qualificados.

## Posicionamento premium

O posicionamento premium exige:

- dados tecnicos bem estruturados;
- historico preservado;
- midia privada e segura;
- auditoria rastreavel;
- multi-tenant consistente;
- UX operacional clara;
- documentos e dossies confiaveis;
- relatorios executivos;
- integracao controlada com prestadores.

Toda feature deve reforcar o HouseLog como prontuario tecnico digital do imovel.

## Fases do HouseLog

### Fase 1: base operacional

- Login.
- Usuarios.
- Tenant.
- Clientes.
- Imoveis.
- Ambientes.
- Chamados.

Objetivo: criar a base segura para uso multi-tenant com contexto por imovel.

### Fase 2: historico tecnico

- Ordens de servico.
- Diagnosticos.
- Fotos.
- Materiais.
- Garantias.
- Relatorios.

Objetivo: transformar operacao em memoria tecnica rastreavel.

### Fase 3: aprovacao e documentos comerciais

- Orcamentos.
- PDF.
- Envio por WhatsApp.
- Aprovacao.

Objetivo: estruturar fluxo comercial e aprovacao de servicos com registros formais.

### Handover Digital concluido

O módulo de Handover Digital já foi concluído como base documental e operacional do prontuário do imóvel.

Entregas já consolidadas:

- emissão privada de pacote;
- snapshot fechado do pacote emitido;
- token público seguro;
- URL pública `/handover/:token`;
- endpoint público seguro;
- estados inválido, expirado, revogado, emitido e aceito;
- aceite digital do proprietário;
- comprovante de aceite digital;
- impressão/salvar PDF via navegador;
- DTO público sanitizado;
- revogação privada segura.

Pendências de evolução:

- PDF completo do pacote de entrega;
- envio do link por WhatsApp/e-mail;
- área do cliente mais avançada para consultar a entrega e seu histórico.

### Fase 4: inteligencia operacional

- Dashboard.
- Manutencao preventiva.
- Alertas.
- Indicadores.
- Historico inteligente.

Objetivo: antecipar problemas, melhorar governanca e dar visibilidade executiva.

### Fase 5: SaaS completo

- Planos.
- Assinatura.
- Permissoes.
- Area do cliente.
- Multi-empresa.

Objetivo: consolidar operacao SaaS escalavel com governanca por tenant e modelo comercial.

## Status atual aproximado

O projeto ja possui base relevante de seguranca e multi-tenant:

- `tenant_id` em entidades principais e premium recentes;
- autorizacao tenant-aware;
- midia privada/R2 em revisao de seguranca;
- credenciais criptografadas;
- audit log com `tenantId` e `propertyId`;
- contracts Zod compartilhados;
- frontend API client modularizado;
- entidades premium recentes para garantias, reformas, handover packages e checklist de handover.
- Handover Digital consolidado como módulo base concluído, com fluxo público e privado funcionando.

O status deve ser tratado como evolucao incremental. Antes de assumir que uma etapa esta completa, verificar migrations, schema, rotas, contracts, testes e frontend consumidor.

## Proximos blocos recomendados

### Handover checklist

Evoluir checklist de entrega tecnica com UX, validacoes operacionais, evidencias, status, pendencias e integracao com dossie.

### Frontend clients premium

Adicionar clients e tipos no frontend para consumir warranties, renovations, handover packages e checklist items sem duplicar contracts.

### Telas premium

Criar telas focadas em prontuario tecnico, garantias, reformas, handover, inventario e documentos. A UI deve seguir The Architectural Lens.

### PDF/dossie tecnico

Gerar dossies tecnicos por imovel, handover, reforma ou garantia, respeitando midia privada, auditoria e autorizacao.

### Handover Digital

Evoluir o módulo já concluído com:

- envio do link por WhatsApp/e-mail;
- PDF completo do pacote de entrega;
- área do cliente avançada para consulta do aceite e histórico.

### Dashboard executivo

Criar indicadores de manutencao, garantias vencendo, pendencias de handover, custos, riscos e historico por imovel.

## Criterio de priorizacao

Priorizar features que:

- reduzem risco operacional;
- aumentam rastreabilidade;
- fortalecem seguranca;
- melhoram experiencia premium;
- reaproveitam contratos existentes;
- preservam compatibilidade com backend e frontend.

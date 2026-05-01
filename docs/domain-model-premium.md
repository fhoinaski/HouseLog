# Modelo de dominio premium

Este documento descreve entidades futuras para consolidar o HouseLog como prontuario tecnico digital de imoveis de alto padrao. As entidades abaixo sao direcionais: nao implicam migration imediata, renomeacao de tabelas existentes ou criacao de endpoints neste momento.

## `technical_systems`

Status de implementação:
Primeira entidade premium implementada de forma incremental. A tabela `technical_systems`, contratos Zod compartilhados, rotas backend e a página `/properties/:id/systems` passam a existir como base real do prontuário técnico. As relações avançadas com pontos técnicos, garantias, documentos e fotos seguem como próximas fases.

Objetivo:
Representar sistemas tecnicos do imovel, como eletrica, hidraulica, ar-condicionado, automacao, impermeabilizacao, gas, energia solar, piscina, irrigacao, seguranca e rede.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `name`
- `type`
- `description`
- `locationSummary`
- `responsibleProviderId`
- `installationDate`
- `lastInspectionAt`
- `status`
- `createdAt`
- `updatedAt`

Relacao com `tenantId`:
Obrigatoria em ambiente multi-tenant. Toda query deve filtrar por `tenantId` quando disponivel.

Relacao com `propertyId`:
Obrigatoria. Um sistema tecnico sempre pertence a um imovel.

Regras de negocio:
- Um imovel pode ter varios sistemas do mesmo tipo quando houver zonas ou equipamentos distintos.
- Sistemas podem se relacionar a documentos, fotos, garantias, pontos tecnicos, manutencoes e OS.
- O status deve refletir uso operacional, como ativo, inativo, em observacao ou substituido.

Risco de seguranca:
Alto. Sistemas podem expor informacoes sensiveis de infraestrutura, seguranca, acesso, automacao e vulnerabilidades do imovel.

Fase recomendada:
Fase 1 do modelo premium, antes do mapa tecnico e das garantias avancadas.

## `technical_points`

Objetivo:
Registrar pontos tecnicos localizados no imovel, como registros, shafts, caixas de passagem, quadros, disjuntores, drenos, ralos, pontos de inspeção, sensores, valvulas e passagens de tubulacao.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `technicalSystemId`
- `roomId`
- `name`
- `type`
- `description`
- `positionX`
- `positionY`
- `floor`
- `referenceImageUrl`
- `qrCode`
- `createdAt`
- `updatedAt`

Relacao com `tenantId`:
Obrigatoria para isolamento.

Relacao com `propertyId`:
Obrigatoria. Pode opcionalmente se relacionar com `roomId` e `technicalSystemId`.

Regras de negocio:
- Pontos podem existir sem planta tecnica, mas devem ter descricao clara.
- Quando houver planta/imagem, coordenadas devem ser relativas ao arquivo de referencia.
- Um ponto pode ter fotos, documentos, garantias e historico de intervencoes.

Risco de seguranca:
Alto. Pontos tecnicos podem revelar localizacao de sistemas criticos, acessos, sensores e infraestrutura.

Fase recomendada:
Fase 2, apos `technical_systems` e antes de mapas interativos completos.

## `technical_photos`

Objetivo:
Armazenar fotos tecnicas contextualizadas, vinculadas a sistemas, pontos, ambientes, reformas, OS ou garantias.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `technicalSystemId`
- `technicalPointId`
- `roomId`
- `serviceOrderId`
- `renovationId`
- `url`
- `caption`
- `takenAt`
- `takenBy`
- `visibility`
- `createdAt`

Relacao com `tenantId`:
Obrigatoria.

Relacao com `propertyId`:
Obrigatoria. Demais relacoes sao contextuais.

Regras de negocio:
- Fotos devem ter contexto minimo: imovel e ao menos uma categoria de uso.
- Fotos de obra/reforma devem preservar ordem temporal.
- Fotos sensiveis devem ter controle de acesso.

Risco de seguranca:
Medio a alto. Fotos podem revelar bens, layout interno, sistemas de seguranca e dados pessoais.

Fase recomendada:
Fase 2, junto com pontos tecnicos e reformas.

## `renovations`

Objetivo:
Registrar reformas e intervenções relevantes no imovel, com escopo, responsaveis, periodo, evidencias e impacto tecnico.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `title`
- `description`
- `scope`
- `startedAt`
- `completedAt`
- `responsibleCompany`
- `responsibleUserId`
- `status`
- `budgetAmount`
- `finalAmount`
- `createdAt`
- `updatedAt`

Relacao com `tenantId`:
Obrigatoria.

Relacao com `propertyId`:
Obrigatoria.

Regras de negocio:
- Uma reforma pode gerar ou agrupar varias OS.
- Deve permitir anexar documentos, fotos antes/depois, garantias e sistemas afetados.
- Reformas concluidas devem alimentar a timeline tecnica do imovel.

Risco de seguranca:
Medio. Pode expor valores, contratos, fornecedores e intervencoes estruturais.

Fase recomendada:
Fase 3, apos documentos, sistemas e fotos tecnicas.

## `warranties`

Objetivo:
Controlar garantias de materiais, equipamentos, servicos, reformas e sistemas tecnicos.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `technicalSystemId`
- `technicalPointId`
- `serviceOrderId`
- `renovationId`
- `documentId`
- `title`
- `providerId`
- `vendorName`
- `startsAt`
- `expiresAt`
- `terms`
- `status`
- `createdAt`
- `updatedAt`

Relacao com `tenantId`:
Obrigatoria.

Relacao com `propertyId`:
Obrigatoria. Vinculos especificos sao opcionais conforme origem da garantia.

Regras de negocio:
- Garantias devem gerar alerta antes do vencimento.
- Devem se relacionar a documentos comprobatórios quando existirem.
- Garantias vencidas devem permanecer no historico.

Risco de seguranca:
Medio. Pode expor contratos, fornecedores, valores e documentos.

Fase recomendada:
Fase 3, em paralelo a reformas e documentos premium.

## `handover_packages`

Objetivo:
Organizar o pacote de entrega premium de uma unidade ou imovel, reunindo documentos, sistemas, garantias, checklist e orientacoes tecnicas.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `builderTenantId`
- `title`
- `version`
- `status`
- `deliveredAt`
- `acceptedAt`
- `deliveredBy`
- `acceptedBy`
- `createdAt`
- `updatedAt`

Relacao com `tenantId`:
Obrigatoria. Em cenarios Builder, pode haver relacao entre tenant da construtora e tenant do cliente.

Relacao com `propertyId`:
Obrigatoria.

Regras de negocio:
- Pode existir mais de uma versao, mas apenas uma versao ativa/entregue por ciclo.
- Deve reunir checklist, documentos, garantias e sistemas.
- Aceite do cliente deve ser auditavel.

Risco de seguranca:
Alto. O pacote pode conter toda a documentacao tecnica e patrimonial da unidade.

Fase recomendada:
Fase 4, produto HouseLog Builder.

## `handover_checklist_items`

Objetivo:
Detalhar os itens de conferencia de entrega do imovel, vinculados a um pacote de handover.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `handoverPackageId`
- `category`
- `title`
- `description`
- `status`
- `required`
- `checkedAt`
- `checkedBy`
- `notes`
- `createdAt`

Relacao com `tenantId`:
Obrigatoria.

Relacao com `propertyId`:
Obrigatoria, mesmo estando vinculado ao pacote.

Regras de negocio:
- Itens obrigatorios devem ser concluídos antes do aceite final, salvo justificativa.
- Devem permitir evidencias e anexos.
- Mudancas apos aceite devem ser auditadas.

Risco de seguranca:
Medio. Pode expor pendencias, nao conformidades e responsabilidades contratuais.

Fase recomendada:
Fase 4, junto com `handover_packages`.

## `property_team_members`

Objetivo:
Modelar prestadores vinculados ao imovel com maior precisao do que colaboradores genericos, diferenciando fixos, temporarios, historicos, convidados e recorrentes.

Campos principais:
- `id`
- `tenantId`
- `propertyId`
- `userId`
- `externalName`
- `externalEmail`
- `externalPhone`
- `type`
- `specialty`
- `status`
- `source`
- `startsAt`
- `expiresAt`
- `lastServiceOrderId`
- `createdAt`
- `updatedAt`

Relacao com `tenantId`:
Obrigatoria.

Relacao com `propertyId`:
Obrigatoria.

Regras de negocio:
- `userId` deve ser opcional para prestador externo ainda nao cadastrado.
- `type` deve diferenciar fixo, temporario e historico.
- Prestador temporario deve ter escopo e expiracao.
- Prestador historico pode ser derivado de OS concluidas, mas uma entidade dedicada permite curadoria.
- Nao deve substituir imediatamente `property_collaborators`; a migracao deve ser incremental.

Risco de seguranca:
Medio a alto. Contem contatos, permissões e acesso operacional ao imovel.

Fase recomendada:
Fase 2 para leitura derivada; Fase 3 para entidade persistida e regras completas.

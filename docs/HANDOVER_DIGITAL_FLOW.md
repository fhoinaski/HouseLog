# Handover Digital Flow

## Objetivo

O Handover Digital do HouseLog transforma a entrega de um imóvel em um processo rastreável, seguro e premium para construtoras, incorporadoras e empresas técnicas.

O objetivo do fluxo é permitir que a unidade já nasça com um prontuário técnico inicial, com documentos, garantias, sistemas técnicos, recomendações e checklist de entrega organizados antes da posse do proprietário.

Na prática, o fluxo deve:

- permitir que a construtora estruture o pacote digital de entrega do imóvel;
- consolidar o acervo técnico inicial sem depender de planilhas ou pastas dispersas;
- reduzir perda de informação entre obra, vistoria, entrega e operação;
- entregar ao proprietário uma chave digital segura para acesso ao pacote emitido;
- manter rastreabilidade de revisão, emissão, aceite e revogação.

## Perfis envolvidos

### Construtora

Responsável por iniciar o fluxo, organizar o pacote de entrega e emitir o handover para a unidade.

### Responsável técnico

Valida os documentos, sistemas, garantias e recomendações antes da emissão. Pode ser engenheiro, arquiteto, coordenador de obra ou outro papel técnico do tenant.

### Proprietário

Recebe o pacote digital e acessa a entrega inicial do imóvel por uma chave segura, com escopo mínimo.

### Administrador do tenant

Garante governança, permissões, auditoria e acesso correto dentro do tenant da construtora ou da operação B2B2C.

### Prestador técnico

Pode participar quando houver inspeções, garantias, ajustes, assistência de entrega ou complementação de dados técnicos.

## Fluxo principal

1. Criar imóvel no contexto da construtora ou do projeto.
2. Anexar documentos de entrega, memoriais, manuais, garantias, plantas e evidências.
3. Rodar a análise inteligente dos documentos.
4. Revisar extrações, candidatos e sugestões aplicáveis ao prontuário.
5. Aplicar os dados aprovados ao imóvel e aos módulos relacionados.
6. Montar o pacote de entrega com o conteúdo técnico consolidado.
7. Revisar o pacote antes da emissão.
8. Emitir a chave digital do handover.
9. Notificar o proprietário e permitir acesso com escopo restrito.
10. Registrar aceite, revogação ou expiração do acesso.

## Estados do pacote

O pacote de handover deve evoluir de forma explícita entre estados operacionais:

- `draft` - pacote em criação;
- `in_review` - pacote em validação técnica;
- `ready_to_issue` - pronto para emissão;
- `issued` - chave digital emitida;
- `accepted` - proprietário confirmou o recebimento;
- `revoked` - emissão cancelada ou invalidada;
- `expired` - validade encerrada.

Regras de transição:

- apenas pacotes revisados podem ser emitidos;
- pacote emitido deve ser auditável;
- pacote revogado não deve reaparecer como ativo;
- pacote expirado deve permanecer consultável apenas para auditoria interna;
- o aceite do proprietário não substitui revisão técnica.

## Dados do pacote

Um pacote de handover deve consolidar, no mínimo:

- imóvel;
- documentos incluídos;
- garantias;
- sistemas técnicos;
- inventário técnico;
- manutenções recomendadas;
- observações;
- responsável pela emissão;
- hash ou versão do pacote;
- validade do link ou chave;
- data de emissão;
- data de aceite, quando houver.

Diretrizes de modelagem:

- o pacote deve representar uma versão fechada do conteúdo entregue;
- o conteúdo precisa registrar o que foi incluído e em qual momento;
- hash/versão ajuda a provar integridade e evitar disputa sobre alteração posterior;
- a validade da chave reduz risco de exposição indevida.

## Segurança

O Handover Digital deve seguir o mesmo padrão de segurança do restante do HouseLog, com restrição forte de escopo e acesso.

Regras obrigatórias:

- nunca expor `tenantId` para o cliente como fonte de verdade;
- o acesso deve ser feito por token ou chave com expiração;
- o escopo do token deve ser mínimo e vinculado ao pacote emitido;
- todo evento sensível deve gerar audit log;
- revogação deve invalidar o acesso imediatamente;
- não expor R2 key;
- não expor URL privada de storage;
- o proprietário só deve ver o pacote que foi realmente emitido para ele;
- qualquer acesso cross-tenant deve falhar de forma segura e sem vazamento de existência.

Checklist de segurança:

- o pacote foi emitido dentro do tenant correto?
- o token tem expiração e escopo mínimo?
- o pacote pode ser revogado sem ambiguidade?
- o acesso público não revela metadados sensíveis?
- os documentos privados continuam protegidos por autorização?
- o audit log registra emissão, aceite, revogação e expiração?

## UX

### Tela da construtora

A tela interna da construtora deve permitir:

- criar o pacote de handover;
- ver documentos e dados já reunidos;
- revisar pendências;
- validar a completude técnica;
- emitir a chave digital.

### Tela de revisão antes da emissão

A revisão deve destacar:

- documentos faltantes;
- garantias pendentes;
- sistemas ainda sem validação;
- recomendações ainda não aplicadas;
- inconsistências que impedem emissão.

### Tela pública ou do cliente

A experiência do proprietário deve ser simples e objetiva:

- abrir a chave digital;
- ver o status da entrega;
- visualizar os itens incluídos;
- aceitar o recebimento;
- acessar o histórico técnico inicial.

### Aceite digital

O aceite deve ser claro, rastreável e não ambíguo:

- mostrar o que está sendo recebido;
- registrar data, hora e identidade do aceite;
- indicar se o pacote está completo ou se possui observações;
- não permitir inferir dados de outros tenants ou imóveis.

### Status de entrega

A interface deve informar de forma explícita:

- pacote em rascunho;
- pacote em revisão;
- pacote pronto para emissão;
- chave emitida;
- pacote aceito;
- chave revogada;
- chave expirada.

## Relação com módulos existentes

O Handover Digital deve reaproveitar módulos já existentes em vez de criar um sistema paralelo.

### `handoverPackages`

É o eixo natural do pacote de entrega. Deve representar a unidade versionada, seu estado e a emissão da chave digital.

### `handoverChecklistItems`

Usado para validar a conferência de entrega antes da emissão.

### `documents`

Fonte do acervo técnico inicial, incluindo manuais, memoriais, laudos, plantas e garantias documentais.

### `warranties`

Usado para consolidar garantias do imóvel, dos sistemas e de itens entregues.

### `technicalSystems`

Usado para incluir o mapa técnico inicial de sistemas do imóvel.

### `inventoryItems`

Usado para descrever itens técnicos ou componentes relevantes entregues junto com a unidade.

### `maintenanceSchedules`

Usado para registrar recomendações de manutenção inicial e rotinas preventivas.

### `ingestion` e `candidates`

Usados para transformar documentos brutos em dados revisáveis antes da composição final do pacote.

## Riscos

### Vazamento cross-tenant

O risco mais grave é expor um pacote de outra construtora, outro empreendimento ou outro imóvel. O fluxo deve ser tenant-aware em todos os pontos.

### Pacote com dados não revisados

Dados derivados da análise inteligente não podem ser apresentados como aprovados sem revisão humana.

### Link público amplo demais

A chave digital não pode virar URL aberta sem expiração, escopo e revogação.

### Pacote desatualizado

Se documentos, garantias ou recomendações mudarem depois da emissão, a versão entregue deve permanecer consistente e a reemissão precisa ser explícita.

### Aceite sem rastreabilidade

O aceite do proprietário deve ser auditável e vinculável à versão exata do pacote recebido.

## Sequência incremental de issues

Sugestão de desdobramento progressivo:

- `P3-HANDOVER-01` - modelar entidade conceitual do pacote de handover e seus estados;
- `P3-HANDOVER-02` - mapear checklist de entrega e critérios de revisão;
- `P3-HANDOVER-03` - definir emissão da chave digital com expiração e revogação;
- `P3-HANDOVER-04` - desenhar experiência interna da construtora;
- `P3-HANDOVER-05` - desenhar experiência do proprietário para aceite digital;
- `P3-HANDOVER-06` - integrar handover com documentos, garantias, sistemas e inventário;
- `P3-HANDOVER-07` - auditar revogação, expiração e histórico do pacote;
- `P3-HANDOVER-08` - preparar contratos e endpoints mínimos para implementação futura.

## Diretriz de produto

O Handover Digital não deve ser tratado como um anexo do onboarding. Ele é a entrega premium do imóvel documentado.

A meta é que a construtora entregue não apenas chaves físicas, mas um ativo operacionalmente legível, tecnicamente rastreável e seguro para continuidade da vida útil do imóvel.
# FRONTEND_AUTHORIZATION_CONSUMPTION_GUIDE.md - HouseLog

## 1. Objetivo

Este guia orienta como o frontend do HouseLog deve consumir actions e fluxos sensiveis alinhados ao Authorization Core do backend.

O frontend nao e autoridade de permissao. Ele deve:

- consumir contratos reais da API;
- apresentar actions sensiveis como decisoes explicitas do usuario;
- tratar erros de autorizacao sem simular policy local;
- evitar UX enganosa em credenciais, documentos, manutencao, OS e provider flow;
- preservar a linguagem de plataforma privada, prontuario tecnico e rede homologada.

Referencias:

- `docs/ACTION_AUTHORIZATION_MATRIX.md`
- `docs/AUDIT_EVENT_CATALOG.md`
- `docs/CREDENTIAL_ACCESS_POLICY.md`
- `docs/AI_READY_CHECKLIST.md`
- `house-log-front/FRONTEND_COMPONENT_GUIDE.md`
- `house-log-back/apps/api/src/lib/authorization.ts`

---

## 2. Principio central

O frontend pode melhorar clareza, intencao e feedback. Ele nao deve decidir permissao sensivel por conta propria.

Regra operacional:

- use roles e dados da sessao apenas para orientar a interface;
- confirme a permissao real pela resposta da API;
- nao esconda falhas de autorizacao como erro generico;
- nao transforme action sensivel em leitura automatica;
- nao mantenha segredo, PIN ou token em estado global, cache persistente ou logs de UI.

---

## 3. Leitura comum x action sensivel

### Leitura comum

Leitura comum busca dados que podem aparecer na tela sem decisao sensivel imediata.

Exemplos:

- listar propriedades;
- listar metadados de credenciais sem `secret`;
- listar documentos;
- listar manutencoes;
- listar oportunidades elegiveis para provider.

Padrao de UX:

- pode carregar em `useEffect` ou fetch inicial;
- deve ter loading, empty e error;
- pode usar `EmptyState`, `PageSection`, `ServiceOrderCard`, `PropertySummaryCard` e `MetricCard`;
- nao deve prometer acesso se a API retornar `403`.

### Action sensivel

Action sensivel altera estado operacional, revela dado protegido ou gera acesso fisico/digital.

Exemplos:

- revelar segredo de credencial;
- gerar acesso temporario;
- concluir manutencao;
- excluir documento;
- enviar proposta por provider;
- alterar status de OS;
- criar link auditavel.

Padrao de UX:

- deve ser acionada por CTA explicita;
- deve comunicar consequencia antes ou durante a acao;
- deve mostrar estado de loading da action, nao loading global da pagina;
- deve tratar `403`, `404` e `409` de forma especifica;
- quando aplicavel, deve usar confirmacao antes de acao destrutiva;
- nao deve disparar automaticamente em renderizacao, hover, prefetch ou abertura de card.

---

## 4. Quando usar CTA explicita

Use CTA explicita quando a chamada:

- revela `secret`, PIN, token ou dado protegido;
- cria acesso temporario ao imovel;
- muda status operacional;
- cria, aceita, envia ou conclui proposta;
- exclui, revoga ou substitui evidencias;
- dispara OCR, extracao ou processamento com custo/risco;
- cria link publico, auditavel ou temporario.

Nao usar auto-fetch para:

- `revealCredentialSecret`;
- `generateTemporaryCredentialAccess`;
- `markMaintenanceDone`;
- `providerProposalSubmit`;
- exclusao de documento;
- criacao de audit link.

Para esses casos, prefira:

- botao com label verbal claro;
- loading local no botao;
- feedback de sucesso curto;
- erro acionavel;
- confirmacao quando houver perda, exposicao ou efeito operacional.

---

## 5. Tratamento de erros

O frontend deve preservar a semantica do backend.

### `403 FORBIDDEN`

Significado:

- o usuario esta autenticado, mas nao tem autorizacao para aquela action no contexto atual.

Comportamento esperado:

- nao tentar reexecutar automaticamente;
- nao sugerir que foi falha temporaria;
- explicar que a acao nao esta disponivel para o perfil/contexto atual;
- manter a tela estavel;
- esconder ou desabilitar novas tentativas apenas depois de uma resposta clara da API, quando fizer sentido.

Copy sugerida:

- "Voce nao tem permissao para executar esta acao neste imovel."
- "Esta acao exige autorizacao especifica no contexto atual."

### `404 NOT_FOUND`

Significado:

- o recurso nao existe, foi removido ou nao pode ser encontrado naquele contexto.

Comportamento esperado:

- atualizar a listagem quando possivel;
- evitar expor detalhes internos;
- orientar retorno ao contexto anterior.

Copy sugerida:

- "Nao encontramos este registro no contexto atual."
- "O item pode ter sido removido ou nao estar mais disponivel."

### `409 CONFLICT`

Significado:

- a action conflita com o estado atual do recurso.

Comportamento esperado:

- nao sobrescrever estado local assumindo sucesso;
- recarregar o recurso ou a lista;
- explicar que a operacao depende do estado atual.

Copy sugerida:

- "O estado deste registro mudou. Atualize os dados antes de tentar novamente."
- "Esta acao nao esta disponivel no status atual."

### Outros erros

- `400` ou `422`: erro de entrada; destacar campo ou mensagem de validacao.
- `500`: falha operacional; manter estado anterior e permitir nova tentativa quando seguro.
- timeout/rede: mostrar erro recuperavel, sem assumir que a action falhou se houver risco de duplicidade.

---

## 6. Search e metadados seguros

Search e uma leitura transversal de descoberta. Ele nao deve ser tratado como acesso ao conteudo completo do recurso.

Regras de frontend:

- exibir apenas metadados retornados pelo endpoint de search;
- usar o resultado como navegacao para a rota contextual do recurso;
- deixar a tela de destino confirmar autorizacao e carregar o conteudo completo;
- nao tentar reconstruir detalhes sensiveis a partir de `title`, `subtitle`, `href` ou `property_id`;
- nao usar search para testar permissao de documento, OS, credencial, evidencia ou provider flow;
- nao esperar OCR, descricoes livres de OS, segredos, URLs de evidencia ou conteudo de mensagem nos resultados.

Padrao de UX:

- tratar `403` na rota de destino como autorizacao contextual, nao como erro de search;
- quando o item nao abrir por `403` ou `404`, orientar retorno ao contexto anterior;
- nao mostrar "sem dados" quando o caso for falta de permissao na rota de destino;
- evitar snippets de conteudo sensivel em cards de resultado.

Regra de compatibilidade:

- se o backend reduzir campos pesquisaveis por seguranca, o frontend deve aceitar menos resultados sem tentar compensar com busca local em dados sensiveis.

---

## 7. Segredos nao sao dados comuns

Credenciais seguem `CREDENTIAL_ACCESS_POLICY.md`.

Regras de frontend:

- listagens de credenciais nunca devem esperar `secret`;
- use `SensitiveField` para revelar/copiar segredo;
- revele segredo somente sob demanda;
- nao armazene segredo em estado global, localStorage, sessionStorage, query string ou analytics;
- nao envie segredo para logs, toast, erro ou componentes que persistem historico;
- limpe valor revelado quando o componente desmontar, modal fechar ou usuario trocar de contexto;
- nao use segredo como texto de debug;
- nao trate `has_secret` como permissao para revelar.

Para `generateTemporaryCredentialAccess`:

- o PIN temporario retornado deve ser tratado como segredo operacional;
- nao registrar PIN em logs de frontend;
- nao manter PIN em cache persistente;
- exibir por tempo/contexto controlado;
- deixar claro `expires_at` e `expires_hours`;
- nunca gravar o PIN em audit payload do frontend.

---

## 8. Nao assumir permissao por papel sem contexto

Papel global nao basta para action sensivel.

Nao fazer:

- "role owner sempre pode tudo";
- "manager sempre pode revelar credencial";
- "provider sempre pode enviar proposta";
- "usuario com acesso ao imovel pode executar qualquer action";
- duplicar a matriz de autorizacao em condicionais extensas no frontend.

Fazer:

- usar role apenas para reduzir ruido visual quando ja houver regra simples;
- chamar o endpoint real para confirmar actions sensiveis;
- tratar `403` como resultado normal de policy;
- manter labels e estados coerentes com o contexto da entidade;
- evitar botao ativo quando faltam dados obrigatorios locais, como `property_id`, `credential_id` ou `service_order_id`.

---

## 9. Consumo de actions prioritarias

### 9.1 `revealCredentialSecret`

Contrato preferencial:

- `POST /properties/:propertyId/credentials/:credId/secret/reveal`

Legado temporario:

- `GET /properties/:propertyId/credentials/:credId/secret`

UX esperada:

- CTA explicita: "Revelar segredo", "Mostrar senha" ou equivalente;
- usar `SensitiveField`;
- loading local;
- nao auto-fetch;
- erro `403` deve comunicar falta de autorizacao contextual;
- nao persistir segredo revelado alem do necessario.

Regra de compatibilidade:

- novos consumidores devem usar `POST /secret/reveal`;
- manter suporte ao legado apenas em wrappers de API enquanto a migracao nao for concluida;
- nao criar novas telas dependentes do `GET` legado.
- estado atual: `credentialsApi.revealSecret` ja usa `POST /secret/reveal`; nao reintroduzir chamada direta ao `GET /secret`.

### 9.2 `generateTemporaryCredentialAccess`

Contrato atual:

- `POST /properties/:propertyId/credentials/:credId/generate-temp-code`

UX esperada:

- CTA explicita;
- quando possivel, coletar ou exibir duracao antes da action;
- mostrar expiracao do acesso temporario;
- tratar o PIN retornado como segredo;
- nao colocar PIN em cards persistentes, URLs, logs ou cache;
- erro `403` deve indicar que a geracao exige autorizacao sensivel.

Observacao:

- o backend audita `temporary_credential_access_generated`;
- o frontend nao deve tentar criar auditoria paralela.

### 9.3 `markMaintenanceDone`

Contrato:

- usar o endpoint action explicito de conclusao de manutencao existente no backend.

UX esperada:

- CTA verbal: "Marcar como realizada";
- nao concluir automaticamente ao abrir a rotina;
- mostrar loading local;
- apos sucesso, atualizar proxima data, status e metricas;
- em `409`, recarregar a rotina antes de nova tentativa;
- em `403`, explicar que a conclusao exige acesso ao contexto do imovel.

### 9.4 `providerProposalSubmit`

Contrato:

- usar o fluxo real de envio de proposta por provider.

UX esperada:

- comunicar rede homologada e elegibilidade, nao marketplace aberto;
- validar campos obrigatorios antes do envio;
- nao assumir que acesso ao portal significa elegibilidade para toda oportunidade;
- tratar `403` como falta de elegibilidade/autorizacao no contexto atual;
- tratar `409` como conflito de status, duplicidade ou oportunidade indisponivel quando o backend indicar;
- apos sucesso, bloquear duplicidade visual e atualizar status da proposta.

---

## 10. Endpoints legados e compatibilidade

Enquanto houver endpoint legado compativel:

- wrappers de API podem manter fallback apenas quando necessario;
- telas novas devem preferir a action explicita;
- copy deve descrever a action, nao o metodo HTTP;
- nao usar legado para contornar autorizacao, auditoria ou confirmacao;
- remover fallback somente apos busca de consumidores e validacao ponta a ponta.

Caso exista `GET` legado para uma action sensivel:

- nao chamar em prefetch;
- nao chamar em renderizacao;
- nao chamar para "testar permissao";
- usar apenas quando o modulo de API ainda precisa preservar compatibilidade.

---

## 11. Estados de UI recomendados

Para actions sensiveis, cada tela deve prever:

- **idle**: action disponivel e contexto carregado;
- **confirming**: quando a action exige confirmacao;
- **submitting**: chamada em andamento, com botao bloqueado;
- **success**: feedback curto e atualizacao dos dados;
- **forbidden**: `403`, sem retry automatico;
- **not_found**: `404`, com retorno ou refresh;
- **conflict**: `409`, com refresh/reload orientado;
- **error**: falha recuperavel sem alterar estado local como se houvesse sucesso.

Evite:

- spinner global para action pequena;
- toast de sucesso antes da resposta da API;
- optimistic update em action sensivel sem garantia de reversao;
- esconder erro de autorizacao atras de empty state generico.

---

## 12. Componentes e linguagem

Use componentes existentes:

- `PageHeader` para contexto da tela;
- `PageSection` para agrupar actions sensiveis;
- `SensitiveField` para credenciais e segredos;
- `EmptyState` para ausencia de dados ou erro recuperavel;
- `ServiceOrderCard` para OS e oportunidades;
- `ActionTile` para navegacao, nao para disparar action sensivel automaticamente.

Linguagem:

- use pt-BR;
- reforcar "prontuario tecnico", "operacao privada", "rede homologada", "acervo tecnico" e "governanca";
- nao usar "marketplace" para provider flow;
- nao prometer acesso se a API ainda pode retornar `403`;
- nao dizer "sem dados" quando o caso e "sem permissao".

---

## 13. Checklist para novas telas

Antes de consumir uma action:

1. A action existe no backend ou e apenas uma ideia futura?
2. O endpoint e leitura comum ou action sensivel?
3. Existe helper no Authorization Core documentado na matriz?
4. A action exige auditoria canonica?
5. O frontend esta usando CTA explicita?
6. `403`, `404` e `409` estao tratados de forma diferente?
7. Algum segredo, PIN ou token esta indo para estado global, cache, URL ou log?
8. O fluxo depende de endpoint legado? Se sim, ha justificativa de compatibilidade?
9. A copy evita marketplace aberto e permissao presumida?
10. O estado mobile permanece claro durante loading, erro e sucesso?

---

## 14. Anti-patterns

Nao fazer:

- duplicar policy do backend no frontend;
- testar permissao revelando segredo;
- fazer prefetch de action sensivel;
- esconder `403` como empty state;
- tratar `secret` como campo comum do DTO;
- manter PIN temporario em store global;
- usar role global como unica condicao para provider proposal;
- usar search como substituto de autorizacao ou carregamento contextual;
- criar botoes para actions que ainda nao existem no backend;
- usar endpoint legado em tela nova sem necessidade;
- criar auditoria paralela no frontend.

---

## 15. Proximos passos recomendados

1. Usar este guia em refatoracoes de credenciais, manutencao, documentos e provider opportunities.
2. Atualizar este documento quando actions novas passarem de candidata para contrato real.
3. Manter alinhamento com `ACTION_AUTHORIZATION_MATRIX.md` sempre que helper mudar de parcial para implementado.
4. Revisar telas sensiveis para remover auto-fetch, optimistic update inseguro e mensagens genericas de autorizacao.
5. Revalidar wrappers de actions sensiveis antes de remover endpoints legados no backend.

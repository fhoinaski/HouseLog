# AI_READY_CHECKLIST.md - HouseLog

## 1. Objetivo

Este documento define uma checklist curta para manter futuras implementacoes do HouseLog preparadas para uma integracao com agente de IA proprio, sem antecipar arquitetura, criar modulos vazios ou desviar do foco atual do produto.

AI-ready, neste contexto, significa que as features deixam dados, contratos, autorizacao e auditoria em formato seguro e compreensivel para automacao futura. Nao significa implementar IA agora.

Referencias:

- `docs/IMPLEMENTATION_ROADMAP.md`
- `docs/BOUNDARY_MAP.md`
- `docs/ARCHITECTURE_TARGET.md`
- `docs/CREDENTIAL_ACCESS_POLICY.md`
- `docs/TECH_DEBT_REGISTER.md`
- `docs/adr/ADR-001-private-platform-not-marketplace.md`
- `docs/adr/ADR-003-provider-network-curated.md`
- `docs/adr/ADR-004-credentials-are-auditable-secrets.md`
- `docs/adr/ADR-005-architecture-evolves-to-multi-tenant.md`
- `house-log-back/apps/api/src/lib/authorization.ts`

---

## 2. Principio central

Toda evolucao deve continuar servindo ao produto atual: gestao tecnica, manutencao, confianca, governanca e operacao privada de imoveis premium.

Uma implementacao so deve ser considerada AI-ready quando:

- respeita as fronteiras reais do HouseLog;
- preserva contratos existentes;
- usa autorizacao contextual;
- protege dados sensiveis;
- gera trilha auditavel quando a acao for relevante;
- deixa dados estruturados o suficiente para leitura futura por humanos e sistemas.

---

## 3. Checklist operacional

### 3.1 Fronteira de dominio

Antes de implementar, responder:

- A feature pertence a qual fronteira do `BOUNDARY_MAP.md`?
- Ela toca Property Operating System, Service Operations, Provider Network, Credentials, Documents ou Audit?
- Ela cria um conceito novo real ou apenas duplica um conceito existente?

Criterio:

- nao criar "AI", "assistant", "agent" ou "automation" como fronteira nova sem ADR;
- preferir evoluir dominios existentes com dados e eventos melhores;
- manter propriedade, OS, documentos, inventario, manutencao e credenciais como fontes primarias.

### 3.2 Contratos e dados estruturados

Toda nova resposta ou DTO deve:

- usar nomes estaveis e sem ambiguidade;
- preservar IDs de entidades relevantes;
- incluir contexto minimo quando necessario: `property_id`, `service_id`, `document_id`, `credential_id`, `provider_id`;
- evitar strings livres quando ja existir enum ou status de dominio;
- nao retornar dados derivados que possam contradizer a fonte de verdade.

Criterio:

- dados devem ser legiveis por UI, auditoria e automacao futura;
- contratos devem continuar humanos e tipados, nao "prompt-shaped";
- payloads nao devem ser criados para uma IA hipotetica se a tela ou API atual nao precisa deles.

### 3.3 Autorizacao contextual

Qualquer dado que um agente futuro poderia ler ou acionar deve seguir os mesmos helpers de autorizacao do backend.

Criterio:

- nunca assumir que acesso de IA e mais amplo que acesso do usuario;
- toda leitura deve respeitar o ator, papel, propriedade e contexto operacional;
- novas rotas sensiveis devem usar helpers nomeados no Authorization Core;
- provider e temp_provider continuam restritos ao contexto real de OS, elegibilidade ou link publico.

### 3.4 Auditoria e rastreabilidade

Acoes criticas devem gerar eventos auditaveis antes de serem boas candidatas a automacao.

Exemplos:

- revelar credencial;
- criar link publico;
- alterar status de OS;
- excluir documento;
- gerar acesso temporario;
- aprovar proposta;
- alterar dado sensivel de propriedade ou prestador.

Criterio:

- registrar ator, entidade, acao e contexto operacional;
- nao gravar segredo, token ou dado sensivel bruto no audit log;
- preferir actions explicitas e semanticas, como `secret_reveal`, em vez de logs genericos.

### 3.5 Dados sensiveis e credenciais

Credenciais e acessos sensiveis nao podem ser tratados como contexto livre para automacao.

Criterio:

- listagens nunca retornam `secret`;
- revelacao continua explicita, auditada e protegida por `canRevealCredentialSecret`;
- novos consumidores devem usar `POST /secret/reveal`, nao o `GET` legado;
- nao colocar segredo em logs, cache, prompt, estado global ou payload de compartilhamento sem escopo formal;
- qualquer evolucao de IA envolvendo credenciais depende de policy granular futura.

### 3.6 Documentos, evidencias e OCR

Documentos sao parte do acervo tecnico do imovel e podem virar fonte importante para IA no futuro, mas precisam permanecer governados.

Criterio:

- todo documento deve ter contexto de propriedade e ator;
- upload, exclusao e OCR devem preservar rastreabilidade;
- erros de processamento devem ser claros;
- URL publica permanente nao deve virar padrao para automacao;
- metadata deve ser preferida a parsing ad hoc de nomes de arquivo.

### 3.7 Acoes explicitas

Um agente futuro so deve acionar operacoes que ja sejam explicitamente modeladas no produto.

Criterio:

- nao criar atalho oculto para uma acao sensivel;
- preferir endpoints semanticos por acao quando houver efeito operacional;
- manter confirmacoes humanas para acoes destrutivas ate haver policy formal;
- nao automatizar decisao financeira, revelacao de segredo ou permissao sem regra documentada.

### 3.8 Linguagem de produto

AI-ready tambem significa manter o modelo mental correto para usuarios e operadores.

Criterio:

- nao usar linguagem de marketplace aberto;
- manter provider como rede homologada/elegivel;
- manter imovel como prontuario tecnico e centro operacional;
- evitar copy que prometa automacao inteligente antes de existir comportamento real.

### 3.9 Multi-tenant futuro

Toda implementacao nova deve evitar dificultar a futura introducao de tenant e organizacao.

Criterio:

- nao depender apenas de role global para acesso sensivel;
- nao criar dados que nao possam ser associados a tenant/organization depois;
- preservar `property_id` e contexto suficiente para backfill;
- considerar provider network por tenant como direcao oficial.

### 3.10 Observabilidade e erros

Erros devem ser claros para humanos e diagnosticaveis por operacao futura.

Criterio:

- retornar `code` estavel em erros de API quando aplicavel;
- evitar erro generico em fluxo sensivel;
- nao expor detalhes internos ou segredos;
- diferenciar validacao, autorizacao, nao encontrado e falha operacional.

---

## 4. Anti-patterns proibidos

Nao fazer:

- criar pasta, modulo ou tabela de IA sem feature real aprovada;
- duplicar regras de autorizacao para um "agent user";
- montar prompts com dados sensiveis sem policy;
- expor segredos para facilitar automacao;
- criar endpoints genericos como `/ai/context` sem boundary e autorizacao;
- gerar resumo automatico que pareca dado oficial sem origem rastreavel;
- transformar provider network em ranking aberto por preco;
- usar IA como justificativa para contrato frouxo ou payload excessivo.

---

## 5. Template de revisao AI-ready

Antes de fechar uma implementacao relevante, responder:

1. Qual fronteira do HouseLog esta sendo alterada?
2. Quais entidades e IDs ficam rastreaveis?
3. Qual helper de autorizacao protege a leitura ou acao?
4. A acao precisa de auditoria?
5. Algum segredo, token, documento ou dado pessoal esta sendo exposto?
6. O contrato continua util para UI e operacao humana?
7. A implementacao dificulta multi-tenant futuro?
8. Existe alguma promessa de IA que ainda nao corresponde a comportamento real?

Se qualquer resposta for incerta, a implementacao deve ser reduzida, documentada ou revisada antes de seguir.

---

## 6. Proximos passos recomendados

1. Usar esta checklist em novas refatoracoes de documentos, credenciais, OS, provider network e auditoria.
2. Evoluir Authorization Core antes de qualquer automacao sensivel.
3. Concluir a migracao de credenciais para a acao `POST /secret/reveal` e remover o legado quando seguro.
4. Melhorar audit log com contexto operacional antes de criar experiencias assistidas.
5. Formalizar uma ADR especifica apenas quando houver proposta concreta de agente, escopo, permissoes e riscos.


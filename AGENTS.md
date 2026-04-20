# AGENTS.md — HouseLog (Root)

## Objetivo

Este arquivo define as regras globais para qualquer agente que trabalhe no repositório HouseLog.

O HouseLog é um sistema SaaS de gestão operacional de imóveis com foco em:
- ordens de serviço;
- manutenção preventiva;
- histórico técnico do imóvel;
- documentos e anexos;
- financeiro;
- colaboração entre owner, manager e provider.

Este arquivo é a autoridade global do repositório.
Arquivos de agentes específicos por domínio complementam este documento:
- `/house-log-front/AGENTS.md`
- `/house-log-back/AGENTS.md`

Quando houver conflito:
1. este arquivo define a regra global;
2. o agente específico do domínio define a execução local;
3. nunca inventar comportamento fora da arquitetura real.

---

## Estrutura oficial do repositório

- `house-log-front` → frontend web/PWA
- `house-log-back` → backend/API

Arquivos estratégicos:
- `DOCUMENTACAO_COMPLETA_HOUSELOG.md`
- `package.json`
- `house-log-front/AGENTS.md`
- `house-log-back/AGENTS.md`

---

## Princípios obrigatórios do projeto

Toda alteração deve:
- respeitar o produto real;
- respeitar os contratos existentes;
- preservar clareza arquitetural;
- evitar duplicação;
- manter facilidade de manutenção;
- favorecer evolução incremental;
- preservar compatibilidade entre frontend e backend.

É proibido:
- inventar endpoints;
- inventar entidades sem aderência ao domínio;
- alterar payloads sem revisar impacto ponta a ponta;
- criar fluxo visual que não exista no backend;
- criar lógica paralela duplicando comportamento já existente;
- quebrar tipagem por conveniência;
- usar `any` sem justificativa forte;
- criar solução “bonita” mas inconsistente com o produto real.

---

## Fonte única de verdade por domínio

### Produto e arquitetura geral
- `DOCUMENTACAO_COMPLETA_HOUSELOG.md`

### Frontend
- `house-log-front/AGENTS.md`

### Backend
- `house-log-back/AGENTS.md`

---

## Regras globais de implementação

Antes de implementar qualquer coisa:
1. identificar o domínio afetado;
2. ler os arquivos relevantes;
3. validar os contratos impactados;
4. mapear riscos de regressão;
5. só então alterar.

Toda entrega deve:
1. explicar o diagnóstico;
2. explicar o plano;
3. implementar com menor risco possível;
4. listar arquivos alterados;
5. apontar validações manuais necessárias.

---

## Regra global de naming e consistência

O design system oficial do HouseLog chama-se:

**The Architectural Lens**

É proibido:
- usar nomes paralelos para o design system;
- introduzir outra identidade visual concorrente;
- criar segunda convenção visual conflitando com a oficial.

Toda linguagem visual nova deve seguir:
- tokens semânticos;
- componentes base reutilizáveis;
- hierarquia editorial;
- profundidade tonal;
- mobile-first;
- legibilidade operacional.

---

## Regras globais de frontend + backend

Toda feature deve respeitar:
- contrato real da API;
- tipagem forte;
- estados de erro previsíveis;
- tratamento de loading/empty/error;
- autorização por papel;
- segurança mínima esperada;
- UX consistente com o fluxo de negócio.

Mudanças em contrato devem considerar:
- rota backend;
- schema e validação;
- cliente frontend;
- tipagem consumidora;
- telas afetadas;
- efeitos colaterais em cache, notificações e estados.

---

## Regra obrigatória para agentes

O agente nunca deve assumir que o projeto é genérico.

Sempre considerar que HouseLog possui:
- fluxo por papéis (`owner`, `manager`, `provider`, `temp_provider`);
- contexto por imóvel;
- ordens de serviço como eixo operacional;
- bids/orçamentos;
- mensagens por OS;
- documentos e financeiro integrados;
- PWA e uso mobile em campo.

Toda solução deve parecer:
- profissional;
- implementável;
- consistente;
- escalável;
- revisável.

---

## Método obrigatório de trabalho

### 1. Diagnóstico
- ler os arquivos reais;
- entender o fluxo atual;
- identificar contratos;
- identificar riscos;
- identificar reaproveitamento possível.

### 2. Plano
- listar arquivos a alterar;
- listar o que será preservado;
- listar o que será melhorado;
- justificar aderência à arquitetura real.

### 3. Implementação
- preferir mudanças incrementais;
- evitar refatoração destrutiva sem necessidade;
- manter código legível;
- manter coesão com o padrão já aceito no projeto.

### 4. Entrega
Sempre informar:
- diagnóstico;
- plano;
- implementação;
- arquivos alterados;
- riscos;
- validações manuais.

---

## Critério de aceite global

Uma alteração só está pronta se:
- respeita a arquitetura do HouseLog;
- respeita os contratos reais;
- não cria fluxo fictício;
- não duplica sistema;
- melhora ou preserva manutenção;
- mantém coerência entre frontend e backend;
- está pronta para revisão humana.

---

## Em caso de ambiguidade

Se houver ambiguidade:
- escolher a solução mais conservadora;
- preservar o comportamento existente;
- não inventar domínio novo;
- deixar explícita a limitação;
- aplicar a menor alteração segura possível.
# Plano de limpeza do historico git - HouseLog

## Contexto

O repositorio `https://github.com/fhoinaski/HouseLog.git` e publico. O historico git
contem identificadores de infraestrutura Cloudflare. A auditoria recente confirmou
que nao ha secret real versionado; o risco confirmado e de exposicao de
identificadores/URLs de infra.

| Identificador | Tipo | Presente desde | Removido em |
|---|---|---|---|
| `houselog-api-dev.sukinodoncai.workers.dev` | Subdomain da conta Cloudflare | `0177ca8` | `160c010` |
| `pub-3ff8849243ae4ec2b6f124cf71160801.r2.dev` | URL de bucket R2 publico dev | `9b27477` | `160c010` |
| `62bd81c4-77da-4867-a996-22fff5e0d258` | D1 database UUID dev | `338b26f` | Ainda presente em `env.dev` |
| `30d1ccabab2349e79151d3dec9eb11de` | KV namespace UUID dev antigo | `338b26f` | `90bbc4e` |
| `348ed46bc04c4921a5874a5254957e45` | KV namespace UUID dev atual | `80a743f` | Ainda presente em `env.dev` |

**Nenhum secret real confirmado** (JWT_SECRET, chave de criptografia, API key,
VAPID key, token Cloudflare ou chave R2) foi encontrado no historico auditado.
Os itens acima sao resource IDs e URLs publicas. Nao sao credenciais de
autenticacao e sao inutilizaveis sem credenciais da conta Cloudflare.

Decisao atual: **ROTACIONAR/DESATIVAR RECURSO**. `git filter-repo` nao deve ser
executado automaticamente e nao e acao emergencial.

---

## Ordem recomendada antes de reescrever historico

Antes de considerar `git filter-repo`, preferir:

1. Desativar public access do bucket R2 dev antigo `pub-3ff8849...r2.dev` ou excluir
   o bucket se ele nao for mais necessario.
2. Excluir/recriar recursos dev expostos se houver preocupacao com enumeracao ou
   vinculo publico: D1 dev e KV dev antigo/atual.
3. Manter secret scan para impedir `.dev.vars`, `R2_PUBLIC_URL` real, subdomain de
   conta e IDs reais conhecidos em arquivos versionados.
4. Redigir documentacao publica externa quando a evidencia interna nao precisar ser
   publicada.

---

## Quando executar esta limpeza

Esta limpeza e **opcional** quando:

- O repositorio precisar ser transferido para uma organizacao nova ou outro owner sem
  associacao ao account subdomain atual; ou
- Uma due diligence/investidor pedir reducao de evidencias historicas mesmo sem
  vazamento de secret; ou
- O time quiser reduzir risco reputacional/processual antes de abrir o projeto para
  terceiros.

Esta limpeza se torna **obrigatoria** apenas se:

- Uma auditoria formal ou contrato exigir historico limpo como condicao; ou
- O bucket R2 `pub-3ff8849...r2.dev` ou outro recurso exposto nao puder ser
  desativado/deletado e a exposicao permanecer relevante; ou
- For encontrado secret real no historico em auditoria futura.

Se nenhuma dessas condicoes se aplicar, o risco tecnico residual e medio-baixo e a
limpeza pode ser adiada. O risco reputacional/processual permanece medio enquanto o
historico publico contiver identificadores reais.

---

## Pre-requisitos obrigatorios

**Antes de rodar qualquer comando:**

1. **Backup completo:**
   ```bash
   git bundle create houselog-backup-$(date +%Y%m%d).bundle --all
   # Guarde o bundle em local seguro fora do repositorio
   ```

2. **Avisar todos os colaboradores** com clones locais. A reescrita invalida todos
   os SHAs. Qualquer clone que fizer `git pull` recebera erro de divergencia; sera
   necessario re-clonar ou forcar reset local:
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

3. **Fechar todas as PRs abertas** no GitHub antes do force push. PRs referenciando
   SHAs antigos ficarao invalidas.

4. **Protections temporarias no GitHub**: em `Settings -> Branches`, desabilitar
   temporariamente a protecao de force push em `main` se habilitada.

5. **Instalar `git-filter-repo`:**
   ```bash
   pip install git-filter-repo
   # OU: brew install git-filter-repo (macOS)
   ```

---

## Procedimento de limpeza

Execute somente se a limpeza tiver sido aprovada ou se uma das condicoes obrigatorias
acima se aplicar.

### Passo 1 - Preparar arquivo de substituicoes

Criar arquivo `replacements.txt` (nao commitado):

```
houselog-api-dev.sukinodoncai.workers.dev==>houselog-api-dev.<redacted>.workers.dev
pub-3ff8849243ae4ec2b6f124cf71160801.r2.dev==>pub-REDACTED.r2.dev
62bd81c4-77da-4867-a996-22fff5e0d258==>00000000-0000-0000-0000-000000000101
30d1ccabab2349e79151d3dec9eb11de==>00000000000000000000000000000101
348ed46bc04c4921a5874a5254957e45==>00000000000000000000000000000101
```

### Passo 2 - Executar git filter-repo

```bash
# ATENCAO: reescreve TODOS os SHAs do historico; irreversivel sem o backup
git filter-repo --replace-text replacements.txt
```

Isso reescreve todas as mensagens de commit e conteudo de arquivos em todos os commits.

### Passo 3 - Verificar resultado

```bash
# Confirmar que nao ha mais ocorrencias no historico reescrito
git log --all -S "sukinodoncai" --oneline
git log --all -S "3ff8849" --oneline
git log --all -S "62bd81c4" --oneline
git log --all -S "30d1ccab" --oneline
git log --all -S "348ed46b" --oneline
# Todos devem retornar vazio
```

### Passo 4 - Tratar branches remotos

```bash
# Listar branches remotos que precisam ser atualizados
git ls-remote --heads origin

# Para cada branch relevante, force push apos rebase na nova base
git push origin main --force-with-lease
git push origin --force-with-lease --tags

# Branches que nao forem atualizados ainda conterao o historico antigo no remote.
# Considerar deletar branches obsoletos antes do force push:
# git push origin --delete claude/nome-do-branch
```

### Passo 5 - Invalidar cache do GitHub

O GitHub mantem os blobs antigos por ate 90 dias mesmo apos force push. Para
limpeza imediata, abrir um ticket no GitHub Support solicitando purge do cache.

---

## Impacto desta operacao

| Item | Impacto |
|---|---|
| Todos os SHAs de commit | Mudam; links externos para commits ficam quebrados |
| PRs/Issues com SHA no titulo/corpo | Referencias ficam invalidas |
| Tags annotated | Sao preservadas pelo git-filter-repo, mas os SHAs subjacentes mudam |
| `.git/refs/remotes` em clones locais | Precisam de re-fetch ou re-clone |
| CI/CD com SHA hardcoded | Precisa de atualizacao |

---

## Alternativas sem reescrita de historico

Se a limpeza completa for desproporcional ao risco, considerar:

1. **Desativar o bucket R2** `pub-3ff8849...r2.dev` no painel Cloudflare. Remove
   acesso ao unico item com risco de exposicao de dados se houver conteudo no bucket.
2. **Excluir/recriar os recursos D1/KV dev expostos** se houver preocupacao com
   enumeracao ou associacao publica:
   ```bash
   wrangler d1 create houselog-db-dev-v2
   wrangler kv namespace create KV --env dev
   # Atualizar wrangler.toml com os novos IDs e fazer deploy
   ```
3. **Manter secret scan** em CI/local para impedir secrets reais, `.dev.vars` e URLs
   publicas R2 hardcoded em arquivos rastreados.
4. **Redigir docs publicas** quando elas nao precisarem preservar evidencias internas.
5. **Aceitar o risco residual**. Os identificadores nao sao credenciais e sao
   inutilizaveis sem API token da conta.

---

## Status

- [ ] Limpeza de historico executada (somente se obrigatoria ou aprovada)
- [ ] Bucket R2 `pub-3ff8849...r2.dev` verificado/desativado
- [ ] Recursos D1/KV dev expostos avaliados para exclusao/recriacao
- [ ] Colaboradores notificados (se limpeza executada)
- [ ] Force push realizado em todos os branches relevantes (se limpeza executada)

Ultima revisao: 2026-05-17. Ver TD-016 em `docs/TECH_DEBT_REGISTER.md`.

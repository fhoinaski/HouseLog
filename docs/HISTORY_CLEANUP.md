# Plano de limpeza do histórico git — HouseLog

## Contexto

O repositório `https://github.com/fhoinaski/HouseLog.git` é público. O histórico git
contém identificadores de infraestrutura Cloudflare que foram removidos dos arquivos
ativos mas permanecem em commits antigos:

| Identificador | Tipo | Presente desde | Removido em |
|---|---|---|---|
| `houselog-api-dev.sukinodoncai.workers.dev` | Subdomain da conta Cloudflare | `0177ca8` | `160c010` |
| `pub-3ff8849243ae4ec2b6f124cf71160801.r2.dev` | URL de bucket R2 público dev | `9b27477` | `160c010` |
| `62bd81c4-77da-4867-a996-22fff5e0d258` | D1 database UUID dev | `338b26f` | `90bbc4e` |
| `30d1ccabab2349e79151d3dec9eb11de` | KV namespace UUID dev | `338b26f` | `90bbc4e` |

**Nenhum secret real** (JWT_SECRET, chave de criptografia, API key, VAPID key) foi
jamais commitado. Os itens acima são resource IDs e URLs públicas — não são credenciais
de autenticação e são inutilizáveis sem o API token da conta Cloudflare.

---

## Quando executar esta limpeza

Esta limpeza é **opcional** e indicada apenas se:

- O repositório precisar ser transferido para uma organização nova ou outro owner sem
  associação ao account subdomain atual; ou
- Uma auditoria de segurança exigir histórico limpo como requisito; ou
- O bucket R2 `pub-3ff8849...r2.dev` não puder ser desativado/deletado.

Se nenhuma dessas condições se aplicar, o risco residual é baixo e a limpeza pode
ser adiada indefinidamente.

---

## Pré-requisitos obrigatórios

**Antes de rodar qualquer comando:**

1. **Backup completo:**
   ```bash
   git bundle create houselog-backup-$(date +%Y%m%d).bundle --all
   # Guarde o bundle em local seguro fora do repositório
   ```

2. **Avisar todos os colaboradores** com clones locais — a reescrita invalida todos
   os SHAs. Qualquer clone que fizer `git pull` receberá erro de divergência; será
   necessário re-clonar ou forçar reset local:
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

3. **Fechar todas as PRs abertas** no GitHub antes do force push — PRs referenciando
   SHAs antigos ficarão inválidas.

4. **Protections temporárias no GitHub**: em `Settings → Branches`, desabilitar
   temporariamente a proteção de force push em `main` se habilitada.

5. **Instalar `git-filter-repo`:**
   ```bash
   pip install git-filter-repo
   # OU: brew install git-filter-repo (macOS)
   ```

---

## Procedimento de limpeza

### Passo 1 — Preparar arquivo de substituições

Criar arquivo `replacements.txt` (não commitado):

```
houselog-api-dev.sukinodoncai.workers.dev==>houselog-api-dev.<redacted>.workers.dev
pub-3ff8849243ae4ec2b6f124cf71160801.r2.dev==>pub-REDACTED.r2.dev
62bd81c4-77da-4867-a996-22fff5e0d258==>00000000-0000-0000-0000-000000000101
30d1ccabab2349e79151d3dec9eb11de==>00000000000000000000000000000101
```

### Passo 2 — Executar git filter-repo

```bash
# ATENÇÃO: reescreve TODOS os SHAs do histórico — irreversível sem o backup
git filter-repo --replace-text replacements.txt
```

Isso reescreve todas as mensagens de commit e conteúdo de arquivos em todos os commits.

### Passo 3 — Verificar resultado

```bash
# Confirmar que não há mais ocorrências no histórico reescrito
git log --all -S "sukinodoncai" --oneline
git log --all -S "3ff8849" --oneline
git log --all -S "62bd81c4" --oneline
git log --all -S "30d1ccab" --oneline
# Todos devem retornar vazio
```

### Passo 4 — Tratar branches remotos

```bash
# Listar branches remotos que precisam ser atualizados
git ls-remote --heads origin

# Para cada branch relevante, force push após rebase na nova base
git push origin main --force-with-lease
git push origin --force-with-lease --tags

# Branches que não forem atualizados ainda conterão o histórico antigo no remote.
# Considerar deletar branches obsoletos antes do force push:
# git push origin --delete claude/nome-do-branch
```

### Passo 5 — Invalidar cache do GitHub

O GitHub mantém os blobs antigos por até 90 dias mesmo após force push. Para
limpeza imediata, abrir um ticket no GitHub Support solicitando purge do cache.

---

## Impacto desta operação

| Item | Impacto |
|---|---|
| Todos os SHAs de commit | Mudam — links externos para commits ficam quebrados |
| PRs/Issues com SHA no título/corpo | Referências ficam inválidas |
| Tags annotated | São preservadas pelo git-filter-repo, mas os SHAs subjacentes mudam |
| `.git/refs/remotes` em clones locais | Precisam de re-fetch ou re-clone |
| CI/CD com SHA hardcoded | Precisam de atualização |

---

## Alternativas sem reescrita de histórico

Se a limpeza completa for desproporcional ao risco, considerar:

1. **Desativar o bucket R2** `pub-3ff8849...r2.dev` no painel Cloudflare — remove
   acesso ao único item com risco de exposição de dados (conteúdo do bucket).
2. **Rotacionar os recursos D1/KV** se houver preocupação com enumeração:
   ```bash
   wrangler d1 create houselog-db-dev-v2
   wrangler kv namespace create KV --env dev
   # Atualizar wrangler.toml com os novos IDs e fazer deploy
   ```
3. **Aceitar o risco residual** — os identificadores não são credenciais e são
   inutilizáveis sem API token da conta. A mitigação nos arquivos ativos já foi feita.

---

## Status

- [ ] Limpeza de histórico executada
- [ ] Bucket R2 `pub-3ff8849...r2.dev` verificado/desativado
- [ ] Colaboradores notificados (se limpeza executada)
- [ ] Force push realizado em todos os branches relevantes (se limpeza executada)

Última revisão: 2026-05-16. Ver TD-016 em `docs/TECH_DEBT_REGISTER.md`.

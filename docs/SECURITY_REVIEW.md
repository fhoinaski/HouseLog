# SECURITY_REVIEW.md — HouseLog

## 1. Objetivo

Este documento define a base de revisão de segurança do HouseLog.

O HouseLog lida com dados operacionais e sensíveis relacionados a imóveis premium, pessoas, prestadores e credenciais de acesso.
Por isso, segurança não é camada opcional. É parte central do produto.

---

## 2. Princípios de segurança

O HouseLog deve operar com base em:

- mínimo privilégio;
- segregação por tenant;
- autorização contextual;
- proteção de credenciais;
- revogação e expiração;
- trilha de auditoria;
- logs seguros;
- previsibilidade operacional.

---

## 3. Dados sensíveis do sistema

O sistema pode lidar com:
- endereços e localização de imóveis;
- documentos;
- fotos e evidências;
- dados financeiros;
- contatos pessoais;
- histórico operacional;
- credenciais de wifi, alarme, fechaduras e acessos;
- links públicos de auditoria e compartilhamento.

Todos esses itens exigem tratamento cuidadoso.

---

## 4. Áreas prioritárias de revisão

## 4.1 Autenticação
Validar:
- fluxo de login;
- refresh token;
- MFA;
- expiração;
- invalidação;
- storage de token;
- logout real;
- tratamento de sessão comprometida.

## 4.2 Autorização
Validar:
- checagem por papel;
- checagem por tenant;
- checagem por property context;
- provider access contextual;
- regras para rotas públicas;
- escopo por operação.

## 4.3 Credenciais sensíveis
Validar:
- armazenamento;
- criptografia em repouso;
- leitura controlada;
- compartilhamento temporário;
- revogação;
- trilha de visualização;
- geração de acesso temporário.

## 4.4 Links públicos
Validar:
- escopo;
- expiração;
- revogação;
- conteúdo mínimo exposto;
- associação ao tenant;
- trilha de uso.

## 4.5 Anexos e arquivos
Validar:
- permissões de leitura;
- upload seguro;
- tipos aceitos;
- validação;
- URLs temporárias quando aplicável;
- exclusão e retenção.

## 4.6 Logs e auditoria
Validar:
- vazamento de segredo em log;
- ausência de trilha para ações críticas;
- correlação por request;
- registro de acesso a dados sensíveis;
- retenção adequada.

---

## 5. Riscos de maior severidade

### Críticos
- acesso indevido entre clientes;
- exposição de credenciais;
- autorização insuficiente;
- rotas públicas com escopo excessivo;
- storage inseguro de segredo;
- ausência de trilha para leitura de dados sensíveis.

### Altos
- refresh/session model fraco;
- upload inseguro;
- links públicos sem revogação adequada;
- logs sensíveis;
- provider com acesso excessivo.

### Médios
- inconsistência de erro;
- revogação incompleta;
- granularidade insuficiente de permissão;
- retenção inadequada de evento.

---

## 6. Diretrizes obrigatórias

## 6.1 Segregação por tenant
Toda informação sensível deve ser isolada por tenant, direta ou indiretamente.

## 6.2 Mínimo privilégio
Nenhum usuário deve acessar mais do que precisa para cumprir sua função.

## 6.3 Credenciais protegidas
Credenciais do imóvel devem ser tratadas como segredos, nunca como campos comuns.

## 6.4 Rotas públicas mínimas
Toda rota pública deve expor o mínimo necessário e sempre com:
- escopo definido;
- expiração;
- revogação;
- trilha de uso.

## 6.5 Auditoria obrigatória
Ações críticas devem gerar evento auditável.

---

## 7. Checklist de revisão de segurança

### Auth
- [ ] tokens possuem estratégia clara de ciclo de vida
- [ ] refresh token pode ser revogado
- [ ] MFA está funcional e consistente
- [ ] logout invalida sessão corretamente

### Authorization
- [ ] papel sozinho não concede acesso amplo
- [ ] acesso é contextual
- [ ] provider só acessa recursos vinculados
- [ ] tenant isolation está garantido

### Credentials
- [ ] secrets estão criptografados
- [ ] leitura é restrita
- [ ] compartilhamento é temporário
- [ ] eventos de acesso são auditados

### Public Links
- [ ] links expiram
- [ ] links podem ser revogados
- [ ] links mostram apenas dados mínimos
- [ ] uso do link é auditável

### Files
- [ ] upload é validado
- [ ] leitura respeita autorização
- [ ] exclusão respeita governança
- [ ] metadados não vazam informação indevida

### Logs
- [ ] logs não expõem segredos
- [ ] há correlação por request
- [ ] há trilha de evento crítico
- [ ] erro interno não vaza detalhes sensíveis

---

## 8. Medidas recomendadas de endurecimento

### Curto prazo
- revisar auth e token storage
- revisar rotas públicas
- revisar módulo de credenciais
- criar audit log mínimo
- bloquear logs sensíveis

### Médio prazo
- criptografia forte para credenciais
- trilha completa de acesso
- revisão granular de permissões
- engine de autorização contextual

### Longo prazo
- políticas formais de retenção
- observabilidade de segurança
- alertas internos para eventos sensíveis
- revisão de compliance contratual

---

## 9. Critério de aceite de segurança

Uma mudança só pode ser considerada segura se:
- preserva isolamento;
- reduz risco ou ao menos não o aumenta;
- mantém autorização contextual;
- não expõe dados sensíveis;
- mantém auditabilidade;
- está alinhada ao posicionamento premium e privado do HouseLog.
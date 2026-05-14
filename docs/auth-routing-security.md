# Segurança de autenticação e roteamento

## Objetivo

As rotas operacionais do HouseLog devem exigir sessão autenticada no frontend e autorização real no backend. O frontend pode melhorar a experiência e bloquear navegação indevida, mas não substitui validação de token, papel e contexto no Worker.

## Rotas públicas

Rotas públicas não devem acionar redirecionamento automático para login quando recebem `401` de chamadas próprias ou auxiliares:

- `/login`
- `/register`
- `/invite/:token`
- `/audit/:token`
- `/share/*`
- `/splash`

Endpoints públicos ou sem sessão obrigatória também são tratados como exceção no client HTTP:

- `/auth/login`
- `/auth/register`
- `/auth/mfa/*`
- `/auth/refresh`
- `/invite/*`
- `/audit/*`
- `/share/*`

## Rotas protegidas

O grupo `house-log-front/src/app/(app)` é protegido por `RequireAuth` e inclui rotas como:

- `/dashboard`
- `/properties`
- `/properties/:id`
- `/financial`
- `/schedule`

Ao acessar uma rota protegida sem usuário carregado, o frontend redireciona com `router.replace` para:

```text
/login?next=<rota_atual>
```

Exemplos:

- `/dashboard` -> `/login?next=%2Fdashboard`
- `/properties/abc/services` -> `/login?next=%2Fproperties%2Fabc%2Fservices`

Após login, a tela de autenticação usa `next` quando ele aponta para uma rota interna segura. Se não existir `next`, o destino volta a ser definido pelo papel do usuário.

## RequireAuth

O componente `RequireAuth` usa `useAuth()`:

- enquanto `loading=true`, exibe uma tela de validação de sessão;
- quando `loading=false` e `user=null`, redireciona para `/login?next=...`;
- quando `user` existe, renderiza o shell e o conteúdo protegido.

Esse componente não altera payloads de API nem cria novo contrato. Ele atua apenas na camada de roteamento do frontend.

## Limpeza de sessão

A sessão local do frontend usa:

- `hl_token`
- `hl_refresh`
- `hl_user`

Ao sair, falhar refresh ou receber `401` em chamada protegida, os três itens devem ser removidos. Isso evita que rotas protegidas sejam liberadas por estado antigo em `localStorage`.

## Limitação do localStorage

O armazenamento atual em `localStorage` preserva compatibilidade com o fluxo existente, mas não é ideal para um SaaS profissional. Tokens em `localStorage` ficam expostos a XSS.

Recomendação futura:

- migrar refresh token para cookie `httpOnly`, `Secure`, `SameSite=Lax` ou `Strict`;
- manter access token curto;
- renovar sessão via endpoint dedicado com proteção CSRF quando necessário;
- centralizar expiração e revogação no backend.

## CORS Vercel + Cloudflare

O Worker deve receber uma lista explícita de origens permitidas via ambiente:

```text
CORS_ORIGINS=https://house-log.vercel.app,http://localhost:3000,http://127.0.0.1:3000
```

Regras:

- não usar `*` com `credentials=true`;
- produção deve aceitar apenas origens configuradas explicitamente;
- `localhost` e `127.0.0.1` são úteis para desenvolvimento;
- a origem `https://house-log.vercel.app` deve estar configurada no ambiente do Worker publicado;
- preflight `OPTIONS` deve responder com `Access-Control-Allow-Origin` apenas quando a origem estiver na lista permitida.

Sem `CORS_ORIGINS` correto no ambiente Cloudflare, o navegador bloqueará chamadas como:

```text
https://house-log.vercel.app -> https://houselog-api-dev.<seu-subdomain>.workers.dev/api/v1/auth/login
```

## Responsabilidade do backend

Mesmo com `RequireAuth`, o backend continua sendo a autoridade:

- validar JWT;
- validar papel;
- validar tenant/contexto;
- não confiar em `tenantId`, `propertyId` ou identificadores sensíveis vindos do client sem checagem de permissão.

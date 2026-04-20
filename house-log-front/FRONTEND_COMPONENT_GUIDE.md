# FRONTEND_COMPONENT_GUIDE.md - Componentes estruturais HouseLog

## Objetivo

Este guia orienta o uso dos componentes estruturais já consolidados no frontend do HouseLog.

Use este arquivo antes de refatorar telas para evitar:
- duplicação de layout;
- estilos locais improvisados;
- drift visual em relação ao The Architectural Lens;
- fluxos ficticios fora dos contratos reais da API.

Regra geral:
- reutilize componentes existentes antes de criar novos;
- preserve contratos de `src/lib/api.ts`;
- mantenha copy em pt-BR;
- use tokens e variantes de `src/components/ui/visual-system.ts`;
- evite hardcode visual quando existir token semântico.

---

## AppShell

Arquivo:
- `src/components/layout/app-shell.tsx`

Use para:
- estruturar áreas autenticadas da aplicação;
- manter `TopNav`, `BottomNav`, `safe-top`, `safe-bottom` e fundo padrao;
- padronizar páginas de app, provider e fluxos operacionais.

Não use para:
- páginas públicas isoladas quando o layout não deve ter navegação autenticada;
- componentes internos de uma página.

Padrao:
```tsx
<AppShell>
  {children}
</AppShell>
```

Observação:
- layouts de rota devem decidir quando renderizar `AppShell`;
- páginas internas normalmente não devem criar outro shell.

---

## PageHeader

Arquivo:
- `src/components/layout/page-header.tsx`

Use para:
- título principal de uma tela;
- contexto editorial curto;
- ações primárias da página.

Props principais:
- `eyebrow`
- `title`
- `description`
- `actions`
- `density`

Padrao:
```tsx
<PageHeader
  eyebrow="Prontuário técnico"
  title={property.name}
  description="Resumo operacional do imóvel."
  actions={<Button>Nova OS</Button>}
/>
```

Regras:
- um `PageHeader` por tela;
- `description` deve explicar contexto, não repetir o título;
- ações devem ser poucas e claras;
- use `density="editorial"` em páginas que precisam de mais hierarquia.

---

## PageSection

Arquivo:
- `src/components/layout/page-section.tsx`

Use para:
- agrupar blocos de conteudo de uma tela;
- criar separação por hierarquia, tom e espaçamento;
- substituir wrappers locais repetidos.

Props principais:
- `title`
- `description`
- `actions`
- `tone`: `plain`, `surface`, `strong`
- `density`
- `contentClassName`

Padrao:
```tsx
<PageSection
  title="Centro operacional"
  description="Indicadores e atalhos principais."
  tone="strong"
  density="editorial"
>
  {content}
</PageSection>
```

Regras:
- prefira `tone="strong"` para blocos de entrada ou resumo;
- prefira `tone="surface"` para blocos de apoio;
- não coloque cards dentro de cards sem necessidade;
- evite divisores duros quando espacamento e superficies resolverem.

---

## MetricCard

Arquivo:
- `src/components/ui/metric-card.tsx`

Use para:
- indicadores numéricos;
- contadores operacionais;
- status resumido de custo, OS, inventário, garantias ou saúde técnica.

Props principais:
- `label`
- `value`
- `helper`
- `icon`
- `tone`: `default`, `accent`, `success`, `warning`, `danger`, `strong`
- `density`

Padrao:
```tsx
<MetricCard
  label="OS abertas"
  value={openOrders}
  helper={`${urgentOrders} urgentes`}
  icon={Wrench}
  tone={urgentOrders > 0 ? 'danger' : 'default'}
/>
```

Regras:
- use `tone` para comunicar estado, não decoração;
- mantenha `value` curto;
- `helper` deve explicar o indicador sem competir com o valor;
- não recrie cards de métricas locais.

---

## ActionTile

Arquivo:
- `src/components/ui/action-tile.tsx`

Use para:
- atalhos de navegação;
- ações rápidas de uma entidade;
- grids de entrada para subrotas operacionais.

Props principais:
- `href`
- `icon`
- `label`
- `description`
- `tone`: `default`, `accent`, `warning`, `success`, `muted`
- `density`

Padrao:
```tsx
<ActionTile
  href={`/properties/${property.id}/services`}
  icon={Wrench}
  label="Serviços"
  tone="accent"
/>
```

Regras:
- use para navegação curta e previsível;
- não use para listar entidades dinâmicas complexas;
- prefira `ServiceOrderCard` para listas de OS;
- `tone` deve reforçar domínio ou estado, não decoração aleatória;
- mantenha labels curtos para mobile.

---

## ServiceOrderCard

Arquivo:
- `src/components/services/service-order-card.tsx`

Use para:
- listas de OS;
- oportunidades do provider;
- linhas clicáveis de operação;
- itens que combinam título, metadados, status e valor.

Props principais:
- `title`
- `meta`
- `value`
- `status`
- `footer`
- `leadingIcon`
- `interactive`
- `density`

Padrao:
```tsx
<ServiceOrderCard
  interactive
  leadingIcon={<Wrench className="h-4 w-4" />}
  title={order.title}
  meta={order.system_type}
  status={<Badge variant="requested">Solicitada</Badge>}
  footer={formatDate(order.created_at)}
/>
```

Regras:
- use dentro de `Link` quando o item navega;
- `status` deve usar `Badge`;
- `footer` deve conter informação secundária;
- não transforme em card genérico para conteúdos que não são OS/operação.

---

## SensitiveField

Arquivo:
- `src/components/ui/sensitive-field.tsx`

Use para:
- credenciais;
- tokens;
- chaves;
- informações protegidas que precisam de revelar/copiar.

Props principais:
- `label`
- `value`
- `hasValue`
- `maskedText`
- `emptyText`
- `onReveal`
- `onCopy`
- `onError`
- `tone`

Padrao:
```tsx
<SensitiveField
  label="Senha"
  hasValue={Boolean(hasPassword)}
  onReveal={() => credentialsApi.revealPassword(id)}
/>
```

Regras:
- não exiba segredo em texto puro fora deste componente;
- use `onReveal` quando o valor deve ser buscado sob demanda;
- mantenha mensagens de erro via fluxo da tela ou toast;
- não use para dados comuns que não são sensíveis.

---

## EmptyState

Arquivo:
- `src/components/ui/empty-state.tsx`

Use para:
- estados vazios;
- falhas recuperáveis;
- ausência de registros;
- orientação de próximo passo.

Props principais:
- `icon`
- `title`
- `description`
- `actions`
- `tone`: `default`, `subtle`, `strong`
- `density`

Padrao:
```tsx
<EmptyState
  icon={<FileText className="h-6 w-6" />}
  title="Nenhum documento cadastrado"
  description="Quando documentos forem anexados ao imóvel, eles aparecerão aqui."
  actions={<Button>Adicionar documento</Button>}
/>
```

Regras:
- explique o estado sem culpar o usuario;
- ofereça ação quando existir próximo passo real;
- não invente fluxo visual sem backend;
- use copy curta e operacional.

---

## PropertySummaryCard

Arquivo:
- `src/components/properties/property-summary-card.tsx`

Use para:
- resumo técnico do imóvel;
- leitura de dados-base do prontuário;
- blocos que precisam comunicar governança, manutenção e histórico técnico.

Props principais:
- `property`
- `className`

Padrao:
```tsx
<PropertySummaryCard property={property} />
```

Dados exibidos:
- área técnica, quando existir;
- ano base, quando existir;
- pavimentos;
- estrutura, quando existir;
- registro HouseLog.

Regras:
- use apenas com o tipo real `Property`;
- não passe dados montados manualmente quando o contrato já fornece `property`;
- não duplique o bloco de detalhes do imóvel em páginas futuras;
- preserve a narrativa de prontuário técnico.

---

## Checklist para novas refatorações

Antes de alterar uma tela:
1. Identifique o domínio afetado: imóvel, OS, provider, documentos, financeiro ou configurações.
2. Leia o contrato consumido em `src/lib/api.ts`.
3. Verifique se `AppShell`, `PageHeader`, `PageSection`, `MetricCard`, `ActionTile`, `ServiceOrderCard`, `SensitiveField`, `EmptyState` ou `PropertySummaryCard` resolvem o caso.
4. Use tokens existentes e variantes do `visual-system.ts`.
5. Preserve loading, empty, error e autorização por papel.
6. Valide mobile antes de considerar a tela pronta.

---

## Anti-padrões

Evite:
- criar `StatCard`, `InfoCard` ou wrappers locais quando `MetricCard` ou `PageSection` resolvem;
- criar tiles locais de navegação quando `ActionTile` resolve;
- hardcodar cores fora dos tokens;
- criar novos aliases `--hl-*`;
- duplicar shells dentro de páginas;
- transformar `ServiceOrderCard` em card genérico;
- exibir informação sensível sem `SensitiveField`;
- criar empty states sem próximo passo real;
- inventar dados, status, rotas ou contratos.

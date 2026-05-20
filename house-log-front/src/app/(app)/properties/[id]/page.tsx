'use client';

import { type ComponentType, type ReactNode, use, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  FolderKanban,
  GitBranch,
  Home,
  KeyRound,
  Lock,
  MapPin,
  Menu,
  Package,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wrench,
  Zap,
  Droplets,
  Layers,
  Paintbrush,
  Grid2x2,
  Umbrella,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react';
import { PageSection } from '@/components/layout/page-section';
import { ExecutivePropertyDashboard } from '@/components/properties/executive-property-dashboard';
import { PremiumPropertyDashboard } from '@/components/properties/premium-property-dashboard';
import { PropertySummaryCard } from '@/components/properties/property-summary-card';
import { PropertyTimelinePanel } from '@/components/properties/property-timeline-panel';
import { PROPERTY_DETAIL_TABS, normalizePropertyDetailTab, type PropertyDetailTabId } from '@/components/properties/property-tabs-model';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { ActionTile } from '@/components/ui/action-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import {
  apiFetcher,
  documentIngestionApi,
  documentsApi,
  inventoryApi,
  maintenanceApi,
  propertiesApi,
  roomsApi,
  serviceRequestsApi,
  servicesApi,
  warrantiesApi,
  type Document,
  type MaintenanceSchedule,
  type InventoryItem,
  type Property,
  type PropertyDashboard,
  type PropertyDocumentIngestionSummary,
  type Room,
  type ServiceRequestSummary,
  type ServiceOrder,
  type Warranty,
} from '@/lib/api';
import {
  buildPropertyTechnicalHealthView,
  type PropertyTechnicalHealthView,
} from '@/lib/property-technical-health';
import { cn, formatCurrency, formatDate, INVENTORY_CATEGORY_LABELS, PROPERTY_TYPE_LABELS, ROOM_TYPE_LABELS, SYSTEM_TYPE_LABELS, scoreBg, scoreColor } from '@/lib/utils';

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn('h-full rounded-full transition-all duration-700', scoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('w-7 shrink-0 text-right text-sm font-medium tabular-nums', scoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

function PropertyProfileHeader({
  property,
  propertyId,
  healthScore,
  technicalHealth,
  openOrders,
  urgentOrders,
  memoriaEmDias,
  totalEvents,
  onCreateOrder,
}: {
  property: Property;
  propertyId: string;
  healthScore: number | null;
  technicalHealth: PropertyTechnicalHealthView;
  openOrders: number;
  urgentOrders: number;
  memoriaEmDias: number;
  totalEvents: number;
  onCreateOrder: () => void;
}) {
  const healthScoreClass = healthScore === null ? 'text-hl-text-muted' : scoreColor(healthScore);
  const clientName = property.owner_name ?? 'Cliente nao informado';

  return (
    <section className="relative overflow-hidden rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface shadow-hl-subtle">
      {property.cover_url ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${property.cover_url})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(247,246,243,0.20),rgba(247,246,243,0.92)_64%,rgba(247,246,243,1))]" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-hl-surface-soft" />
      )}

      <div className="relative z-10 p-4 sm:p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/properties" className="text-xs font-medium text-hl-text-muted transition-colors hover:text-hl-text">
                Meus imoveis
              </Link>
              <span className="text-hl-text-muted">/</span>
              <Badge variant="secondary" className="text-xs">
                {PROPERTY_TYPE_LABELS[property.type]}
              </Badge>
              <Badge variant={urgentOrders > 0 ? 'urgent' : openOrders > 0 ? 'requested' : 'success'}>
                {urgentOrders > 0 ? 'Critico' : openOrders > 0 ? 'Em operacao' : 'Estavel'}
              </Badge>
            </div>

            <p className="mt-5 text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Perfil 360 do imovel</p>
            <h1 className="mt-2 text-3xl font-medium leading-tight tracking-normal text-hl-text md:text-4xl">{property.name}</h1>

            <div className="mt-3 grid gap-2 text-sm text-hl-text-muted md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
              <p className="flex min-w-0 items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{property.address}, {property.city}</span>
              </p>
              <p className="flex min-w-0 items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">Cliente: {clientName}</span>
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <Link href={`/properties/${propertyId}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <Link href={`/properties/${propertyId}/report`}>
                <FileText className="h-3.5 w-3.5" />
                Dossie
              </Link>
            </Button>
            <Button size="sm" onClick={onCreateOrder} className="w-full sm:w-auto">
              <Wrench className="h-3.5 w-3.5" />
              Nova OS
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-border sm:grid-cols-2 lg:grid-cols-4">
          <ProfileStat label="Saude" value={healthScore ?? 'Em formacao'} helper={technicalHealth.label} valueClassName={healthScoreClass} suffix={healthScore === null ? null : '/100'} />
          <ProfileStat label="Memoria" value={memoriaEmDias.toLocaleString('pt-BR')} helper="dias rastreados" />
          <ProfileStat label="Eventos" value={totalEvents} helper="OS registradas" />
          <div className="bg-hl-surface px-3 py-3 sm:px-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-hl-text-muted">Estado tecnico</p>
            {healthScore === null ? (
              <p className="mt-2 text-xs leading-5 text-hl-text-muted">Aguardando documentos tecnicos.</p>
            ) : (
              <div className="mt-3">
                <ScoreBar score={healthScore} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileStat({
  label,
  value,
  helper,
  suffix,
  valueClassName,
}: {
  label: string;
  value: string | number;
  helper: string;
  suffix?: string | null;
  valueClassName?: string;
}) {
  return (
    <div className="bg-hl-surface px-3 py-3 sm:px-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-hl-text-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn('text-xl font-medium tabular-nums text-hl-text sm:text-2xl', valueClassName)}>{value}</span>
        {suffix ? <span className="text-xs text-hl-text-muted">{suffix}</span> : null}
      </div>
      <p className="mt-1 text-[10px] text-hl-text-muted">{helper}</p>
    </div>
  );
}

function PropertyTabs({
  propertyId,
  tabs,
  activeTab,
}: {
  propertyId: string;
  tabs: PropertyProfileTab[];
  activeTab: Tab;
}) {
  return (
    <nav aria-label="Perfil 360 do imovel" className="w-full min-w-0 overflow-x-auto rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface px-2 py-2 shadow-hl-subtle">
      <div className="flex w-max min-w-max gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const className = cn(
            'inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--hl-radius-md)] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
            isActive ? 'bg-hl-accent-muted text-hl-accent' : 'text-hl-text-muted hover:bg-hl-surface-soft hover:text-hl-text'
          );

          return (
            <Link
              key={tab.id}
              href={`/properties/${propertyId}?tab=${tab.id}`}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={className}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PropertySummaryCards({ metrics }: { metrics: ProfileMetric[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          helper={metric.helper}
          icon={metric.icon}
          tone={metric.tone ?? 'default'}
          density="compact"
        />
      ))}
    </div>
  );
}

function PropertyEmptyState({
  icon,
  title,
  description,
  href,
  actionLabel,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      actions={
        <Button asChild variant="tonal" size="sm">
          <Link href={href}>{actionLabel}</Link>
        </Button>
      }
      tone="subtle"
    />
  );
}

type PropertyModuleTone = 'default' | 'accent' | 'warning' | 'success' | 'muted';
type PropertyModuleSection = 'main' | 'technical' | 'operations' | 'financial' | 'admin';

type PropertyModuleShortcut = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  tone: PropertyModuleTone;
  tabId?: PropertyDetailTabId;
};

type PropertyModuleGroup = {
  id: string;
  section: PropertyModuleSection;
  title: string;
  shortcuts: PropertyModuleShortcut[];
};

function buildPropertyModuleGroups(propertyId: string): PropertyModuleGroup[] {
  return [
    {
      id: 'main',
      section: 'main',
      title: 'Principal',
      shortcuts: [
        { href: `/properties/${propertyId}?tab=overview`, tabId: 'overview', icon: Building2, label: 'Visao geral', description: 'Resumo 360', tone: 'accent' },
        { href: `/properties/${propertyId}?tab=rooms`, tabId: 'rooms', icon: Home, label: 'Ambientes', description: 'Comodos e areas', tone: 'default' },
        { href: `/properties/${propertyId}?tab=tickets`, tabId: 'tickets', icon: ClipboardCheck, label: 'Chamados', description: 'Solicitacoes', tone: 'warning' },
        { href: `/properties/${propertyId}?tab=services`, tabId: 'services', icon: Wrench, label: 'Ordens de servico', description: 'Execucao tecnica', tone: 'accent' },
        { href: `/properties/${propertyId}?tab=history`, tabId: 'history', icon: GitBranch, label: 'Historico', description: 'Linha operacional', tone: 'muted' },
      ],
    },
    {
      id: 'technical-record',
      section: 'technical',
      title: 'Prontuario tecnico',
      shortcuts: [
        { href: `/properties/${propertyId}?tab=photos`, tabId: 'photos', icon: Paintbrush, label: 'Fotos', description: 'Evidencias visuais', tone: 'muted' },
        { href: `/properties/${propertyId}?tab=documents`, tabId: 'documents', icon: FileText, label: 'Documentos', description: 'Arquivos do imovel', tone: 'muted' },
        { href: `/properties/${propertyId}?tab=warranties`, tabId: 'warranties', icon: ShieldCheck, label: 'Garantias', description: 'Contratos e prazos', tone: 'success' },
        { href: `/properties/${propertyId}?tab=inventory`, tabId: 'inventory', icon: Package, label: 'Inventario', description: 'Itens e sistemas', tone: 'warning' },
        { href: `/properties/${propertyId}?tab=handover`, tabId: 'handover', icon: ClipboardCheck, label: 'Dossie', description: 'Entrega tecnica', tone: 'muted' },
        { href: `/properties/${propertyId}/renovations`, icon: FolderKanban, label: 'Reformas', description: 'Obras e intervencoes', tone: 'accent' },
      ],
    },
    {
      id: 'operations',
      section: 'operations',
      title: 'Operacional',
      shortcuts: [
        { href: `/properties/${propertyId}/maintenance`, icon: RefreshCw, label: 'Manutencao', description: 'Plano preventivo', tone: 'warning' },
        { href: `/properties/${propertyId}/map`, icon: Compass, label: 'Mapa tecnico', description: 'Pontos e sistemas', tone: 'muted' },
      ],
    },
    {
      id: 'financial',
      section: 'financial',
      title: 'Financeiro',
      shortcuts: [
        { href: `/properties/${propertyId}/financial`, icon: BarChart3, label: 'Financeiro', description: 'Despesas e custos', tone: 'success' },
        { href: `/properties/${propertyId}/report`, icon: Activity, label: 'Relatorio', description: 'Dossie do imovel', tone: 'accent' },
      ],
    },
    {
      id: 'administration',
      section: 'admin',
      title: 'Administracao',
      shortcuts: [
        { href: `/properties/${propertyId}/team`, icon: Users, label: 'Equipe', description: 'Responsaveis', tone: 'muted' },
        { href: `/properties/${propertyId}/access`, icon: KeyRound, label: 'Acessos', description: 'Permissoes', tone: 'muted' },
        { href: `/properties/${propertyId}/credentials`, icon: Lock, label: 'Credenciais', description: 'Acessos tecnicos', tone: 'muted' },
      ],
    },
  ];
}

function propertyModuleToneClasses(tone: PropertyModuleTone): string {
  switch (tone) {
    case 'accent':
      return 'bg-hl-accent-muted text-hl-accent';
    case 'warning':
      return 'bg-[color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))] text-hl-warning';
    case 'success':
      return 'bg-[color-mix(in_srgb,var(--hl-success)_12%,var(--hl-surface))] text-hl-success';
    case 'muted':
      return 'bg-hl-surface-muted text-hl-text-muted';
    default:
      return 'bg-hl-surface-soft text-hl-text-muted';
  }
}

function PropertyModuleShortcutLink({
  shortcut,
  isActive = false,
  layout = 'list',
  onNavigate,
}: {
  shortcut: PropertyModuleShortcut;
  isActive?: boolean;
  layout?: 'list' | 'chip';
  onNavigate?: () => void;
}) {
  const Icon = shortcut.icon;
  const iconClassName = cn(
    'flex shrink-0 items-center justify-center rounded-[var(--hl-radius-sm)]',
    layout === 'chip' ? 'h-7 w-7' : 'h-8 w-8',
    isActive ? 'bg-hl-surface text-hl-accent' : propertyModuleToneClasses(shortcut.tone)
  );

  return (
    <Link
      href={shortcut.href}
      scroll={shortcut.tabId ? false : undefined}
      aria-label={`Abrir ${shortcut.label}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'group flex min-w-0 items-center text-left transition-colors hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] active:scale-[0.99]',
        layout === 'chip'
          ? 'min-h-11 shrink-0 gap-2 rounded-[var(--hl-radius-md)] border border-hl-border bg-hl-surface px-3 py-2 shadow-hl-subtle'
          : 'gap-2.5 rounded-[var(--hl-radius-md)] px-2.5 py-2',
        isActive ? 'bg-hl-accent-muted text-hl-accent' : 'text-hl-text-muted'
      )}
    >
      <span className={iconClassName}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate text-sm font-medium', isActive ? 'text-hl-accent' : 'text-hl-text')}>{shortcut.label}</span>
        <span className={cn('mt-0.5 block truncate text-[11px] leading-4 text-hl-text-muted', layout === 'chip' && 'max-w-32')}>{shortcut.description}</span>
      </span>
    </Link>
  );
}

function getSecondaryModuleGroups(groups: PropertyModuleGroup[]): PropertyModuleGroup[] {
  return groups.filter((group) => group.section !== 'main');
}

function PropertyModuleBar({
  groups,
  activeTab,
}: {
  groups: PropertyModuleGroup[];
  activeTab: PropertyDetailTabId;
}) {
  const shortcuts = getSecondaryModuleGroups(groups).flatMap((group) => group.shortcuts);

  return (
    <section className="hidden min-w-0 rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-3 shadow-hl-subtle md:block" aria-label="Modulos do imovel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">Modulos do imovel</p>
          <p className="mt-1 text-xs text-hl-text-muted">Atalhos tecnicos e administrativos sem sair do perfil.</p>
        </div>
      </div>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {shortcuts.map((shortcut) => (
          <PropertyModuleShortcutLink
            key={shortcut.href}
            shortcut={shortcut}
            isActive={shortcut.tabId === activeTab}
            layout="chip"
          />
        ))}
      </div>
    </section>
  );
}

function PropertyMobileModulesMenu({
  groups,
  activeTab,
}: {
  groups: PropertyModuleGroup[];
  activeTab: PropertyDetailTabId;
}) {
  const [open, setOpen] = useState(false);
  const secondaryGroups = getSecondaryModuleGroups(groups);
  const hasActiveModule = secondaryGroups.some((group) =>
    group.shortcuts.some((shortcut) => shortcut.tabId === activeTab)
  );

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn('w-full justify-center', hasActiveModule && 'border-hl-accent bg-hl-accent-muted text-hl-accent')}
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
        Mais modulos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bottom-0 top-auto w-full max-w-none translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-[var(--hl-radius-lg)] border-x-0 border-b-0 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:max-w-md md:hidden">
          <DialogHeader>
            <DialogTitle>Mais modulos</DialogTitle>
            <DialogDescription>Acesse prontuario, financeiro e administracao do imovel.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] space-y-4 overflow-y-auto pr-1">
            {secondaryGroups.map((group) => (
              <section key={group.id} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-hl-text-muted">{group.title}</p>
                <div className="grid gap-1.5">
                  {group.shortcuts.map((shortcut) => (
                    <PropertyModuleShortcutLink
                      key={shortcut.href}
                      shortcut={shortcut}
                      isActive={shortcut.tabId === activeTab}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PropertyOverviewPanel({
  propertyId,
  property,
  documents,
  documentsLoading,
  documentsError,
  serviceOrders,
  requests,
  operationsLoading,
}: {
  propertyId: string;
  property: Property;
  documents: Document[];
  documentsLoading: boolean;
  documentsError: boolean;
  serviceOrders: ServiceOrder[];
  requests: ServiceRequestSummary[];
  operationsLoading: boolean;
}) {
  const recentDocuments = documents
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);
  const linkedOperations = [
    ...requests.map((request) => ({
      id: `request-${request.id}`,
      title: request.title,
      description: request.pending_proposals_count > 0 ? `${request.pending_proposals_count} proposta(s) pendente(s)` : 'Chamado aberto',
      href: `/properties/${propertyId}/service-requests/${request.id}`,
      date: request.updated_at,
      badge: 'Chamado',
    })),
    ...serviceOrders.map((order) => ({
      id: `service-${order.id}`,
      title: order.title,
      description: order.assigned_to_name ?? SYSTEM_TYPE_LABELS[order.system_type] ?? order.system_type,
      href: `/properties/${propertyId}/services/${order.id}`,
      date: order.completed_at ?? order.created_at,
      badge: order.status === 'in_progress' ? 'Em execucao' : order.status === 'requested' ? 'Diagnostico' : 'OS',
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <PageSection
      title="Visao geral 360"
      description="Dados de identificacao, ultimos documentos e movimentos operacionais do imovel."
      tone="surface"
      density="editorial"
    >
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Dados principais</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <ProfileInfo label="Cliente vinculado" value={property.owner_name ?? 'Nao informado'} />
            <ProfileInfo label="Endereco" value={`${property.address}, ${property.city}`} />
            <ProfileInfo label="Tipo" value={PROPERTY_TYPE_LABELS[property.type]} />
            <ProfileInfo label="Area / Ano" value={`${property.area_m2 ? `${property.area_m2} m2` : 'Area nao informada'} / ${property.year_built ?? 'Ano nao informado'}`} />
            <ProfileInfo label="Estrutura" value={property.structure ?? 'Nao informada'} />
          </dl>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Documentos recentes</p>
              <Link href={`/properties/${propertyId}/documents`} className="text-xs font-medium text-hl-accent hover:underline">Ver todos</Link>
            </div>
            {documentsError ? (
              <p className="mt-4 rounded-[var(--hl-radius-md)] bg-bg-danger px-3 py-2 text-xs text-text-danger">Nao foi possivel carregar documentos.</p>
            ) : documentsLoading ? (
              <div className="mt-4 space-y-2">
                {[...Array(3)].map((_, index) => <div key={index} className="hl-skeleton h-12 rounded-[var(--hl-radius-md)]" />)}
              </div>
            ) : recentDocuments.length > 0 ? (
              <div className="mt-4 space-y-2">
                {recentDocuments.map((document) => (
                  <Link key={document.id} href={`/properties/${propertyId}/documents`} className="block rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-2 transition-colors hover:bg-hl-surface-muted">
                    <span className="block truncate text-sm font-medium text-hl-text">{document.title}</span>
                    <span className="mt-0.5 block text-xs text-hl-text-muted">{formatDate(document.created_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <PropertyEmptyState
                icon={<FileText className="h-6 w-6" />}
                title="Sem documentos"
                description="Envie arquivos tecnicos para formar a memoria do imovel."
                href={`/properties/${propertyId}/documents`}
                actionLabel="Abrir documentos"
              />
            )}
          </section>

          <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Chamados e OS</p>
              <Link href={`/properties/${propertyId}/services`} className="text-xs font-medium text-hl-accent hover:underline">Ver OS</Link>
            </div>
            {operationsLoading ? (
              <div className="mt-4 space-y-2">
                {[...Array(3)].map((_, index) => <div key={index} className="hl-skeleton h-12 rounded-[var(--hl-radius-md)]" />)}
              </div>
            ) : linkedOperations.length > 0 ? (
              <div className="mt-4 space-y-2">
                {linkedOperations.map((operation) => (
                  <Link key={operation.id} href={operation.href} className="block rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-2 transition-colors hover:bg-hl-surface-muted">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-hl-text">{operation.title}</span>
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.06em] text-hl-text-muted">{operation.badge}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-hl-text-muted">{operation.description}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <PropertyEmptyState
                icon={<Wrench className="h-6 w-6" />}
                title="Sem chamados ou OS"
                description="Registre a primeira demanda para iniciar o historico operacional."
                href={`/properties/${propertyId}/service-requests`}
                actionLabel="Abrir chamados"
              />
            )}
          </section>
        </div>
      </div>
    </PageSection>
  );
}

function PropertyRoomsPanel({ propertyId, rooms, isLoading }: { propertyId: string; rooms: Room[]; isLoading: boolean }) {
  const byFloor = rooms.reduce<Record<number, Room[]>>((acc, room) => {
    const floor = room.floor;
    (acc[floor] ??= []).push(room);
    return acc;
  }, {});
  const floors = Object.keys(byFloor)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <PageSection title="Ambientes" description="Leitura dos cômodos vinculados ao imóvel." tone="surface" density="editorial">
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, index) => <div key={index} className="hl-skeleton h-24 rounded-[var(--hl-radius-lg)]" />)}
        </div>
      ) : rooms.length > 0 ? (
        <div className="space-y-4">
          {floors.map((floor) => (
            <section key={floor} className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-hl-text-muted">
                  {floor === 0 ? 'Térreo' : floor === -1 ? 'Subsolo' : `${floor}º andar`}
                </p>
                <span className="flex-1 border-t border-hl-border" aria-hidden="true" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {byFloor[floor]?.map((room) => (
                  <article key={room.id} className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
                    <p className="text-sm font-medium text-hl-text">{room.name}</p>
                    <p className="mt-1 text-xs leading-5 text-hl-text-muted">{ROOM_TYPE_LABELS[room.type] ?? room.type}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-hl-text-muted">
                      <span>Andar {room.floor}</span>
                      <span>{room.area_m2 ? `${room.area_m2} m²` : 'Área não informada'}</span>
                    </div>
                    {room.notes ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-hl-text-muted">{room.notes}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <Link href={`/properties/${propertyId}/rooms`}>Abrir ambientes</Link>
            </Button>
          </div>
        </div>
      ) : (
        <PropertyEmptyState
          icon={<Home className="h-6 w-6" />}
          title="Nenhum ambiente cadastrado"
          description="Cadastre cômodos para organizar inventário, manutenção e contexto operacional do imóvel."
          href={`/properties/${propertyId}/rooms`}
          actionLabel="Abrir ambientes"
        />
      )}
    </PageSection>
  );
}

function PropertyTicketsPanel({
  propertyId,
  requests,
  isLoading,
}: {
  propertyId: string;
  requests: ServiceRequestSummary[];
  isLoading: boolean;
}) {
  const openCount = requests.filter((request) => request.status === 'OPEN').length;
  const withProposals = requests.filter((request) => request.proposals_count > 0).length;

  return (
    <PageSection title="Chamados" description="Solicitações de orçamento e seu estágio comercial." tone="surface" density="editorial">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={FileText} label="Abertos" value={openCount} helper="solicitações em andamento" tone="warning" density="compact" />
        <MetricCard icon={ClipboardCheck} label="Com propostas" value={withProposals} helper="já receberam retorno" tone="accent" density="compact" />
        <MetricCard icon={CheckCircle2} label="Total" value={requests.length} helper="registros carregados" tone="default" density="compact" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[...Array(2)].map((_, index) => <div key={index} className="hl-skeleton h-36 rounded-[var(--hl-radius-lg)]" />)}
        </div>
      ) : requests.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {requests.slice(0, 6).map((request) => (
            <article key={request.id} className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-hl-text">{request.title}</p>
                  <p className="mt-1 text-xs leading-5 text-hl-text-muted">
                    {request.status === 'OPEN' ? 'Chamado aberto' : 'Chamado encerrado'} · {request.proposals_count} proposta(s)
                  </p>
                </div>
                <Badge variant={request.accepted_proposals_count > 0 ? 'success' : request.proposals_count > 0 ? 'warning' : 'normal'}>
                  {request.accepted_proposals_count > 0 ? 'Aprovado' : request.proposals_count > 0 ? 'Em análise' : 'Aguardando'}
                </Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-hl-text-muted">{request.description ?? 'Sem descrição detalhada.'}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-hl-text-muted">Atualizado em {formatDate(request.updated_at ?? request.created_at)}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${propertyId}/service-requests/${request.id}`}>Abrir</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <PropertyEmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Nenhum chamado encontrado"
          description="Os chamados e propostas desse imóvel aparecem aqui quando houver solicitações carregadas."
          href={`/properties/${propertyId}/service-requests`}
          actionLabel="Abrir chamados"
        />
      )}
    </PageSection>
  );
}

function PropertyServicesPanel({
  propertyId,
  orders,
  isLoading,
}: {
  propertyId: string;
  orders: ServiceOrder[];
  isLoading: boolean;
}) {
  const openCount = orders.filter((order) => order.status === 'requested' || order.status === 'approved').length;
  const activeCount = orders.filter((order) => order.status === 'in_progress').length;
  const closedCount = orders.filter((order) => order.status === 'completed' || order.status === 'verified').length;

  return (
    <PageSection title="Ordens de serviço" description="Execução técnica e histórico operacional do imóvel." tone="surface" density="editorial">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Wrench} label="Abertas" value={openCount} helper="aguardando execução" tone="warning" density="compact" />
        <MetricCard icon={RefreshCw} label="Em execução" value={activeCount} helper="trabalho em campo" tone="accent" density="compact" />
        <MetricCard icon={CheckCircle2} label="Concluídas" value={closedCount} helper="histórico fechado" tone="success" density="compact" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[...Array(2)].map((_, index) => <div key={index} className="hl-skeleton h-36 rounded-[var(--hl-radius-lg)]" />)}
        </div>
      ) : orders.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {orders.slice(0, 6).map((order) => (
            <article key={order.id} className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-hl-text">{order.title}</p>
                  <p className="mt-1 text-xs leading-5 text-hl-text-muted">
                    {SYSTEM_TYPE_LABELS[order.system_type] ?? order.system_type} · {order.assigned_to_name ?? 'Sem prestador definido'}
                  </p>
                </div>
                <Badge variant={order.status === 'in_progress' ? 'warning' : order.status === 'completed' || order.status === 'verified' ? 'success' : 'normal'}>
                  {order.status === 'in_progress' ? 'Em execução' : order.status === 'completed' || order.status === 'verified' ? 'Concluída' : 'Aberta'}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-hl-text-muted">
                <span>{formatDate(order.created_at)}</span>
                {order.cost != null ? <span>{formatCurrency(order.cost)}</span> : <span>Sem custo</span>}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${propertyId}/services/${order.id}`}>Abrir OS</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <PropertyEmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="Nenhuma OS carregada"
          description="As ordens de serviço aparecem aqui quando existirem registros carregados para este imóvel."
          href={`/properties/${propertyId}/services`}
          actionLabel="Abrir serviços"
        />
      )}
    </PageSection>
  );
}

function countPhotos(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').length : 0;
  } catch {
    return 0;
  }
}

function PropertyPhotosPanel({ propertyId, orders, isLoading }: { propertyId: string; orders: ServiceOrder[]; isLoading: boolean }) {
  const photoOrders = orders.filter((order) => countPhotos(order.before_photos) > 0 || countPhotos(order.after_photos) > 0);

  return (
    <PageSection title="Fotos" description="Evidências visuais registradas nas OS concluídas ou em execução." tone="surface" density="editorial">
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => <div key={index} className="hl-skeleton h-36 rounded-[var(--hl-radius-lg)]" />)}
        </div>
      ) : photoOrders.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photoOrders.slice(0, 6).map((order) => (
            <article key={order.id} className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
              <p className="truncate text-sm font-medium text-hl-text">{order.title}</p>
              <p className="mt-1 text-xs text-hl-text-muted">
                {countPhotos(order.before_photos)} antes · {countPhotos(order.after_photos)} depois
              </p>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${propertyId}/services/${order.id}`}>Ver OS</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <PropertyEmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Sem evidências visuais"
          description="As fotos de antes e depois aparecem aqui quando houver OS com mídia registrada."
          href={`/properties/${propertyId}/timeline`}
          actionLabel="Abrir histórico"
        />
      )}
    </PageSection>
  );
}

function PropertyDocumentsPanel({
  propertyId,
  documents,
  documentsLoading,
  documentsError,
  ingestionStatus,
}: {
  propertyId: string;
  documents: Document[];
  documentsLoading: boolean;
  documentsError: boolean;
  ingestionStatus: IngestionSummaryStatus;
}) {
  return (
    <div className="space-y-6">
      <SmartRecordWidget propertyId={propertyId} {...ingestionStatus} />
      <TechnicalPendingPanel propertyId={propertyId} {...ingestionStatus} />
      <SmartRecordEmptyPrompt propertyId={propertyId} summary={ingestionStatus.summary} isLoading={ingestionStatus.isLoading} />

      <PageSection title="Documentos" description="Arquivos recentes e leitura documental do imóvel." tone="surface" density="editorial">
        {documentsError ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Não foi possível carregar documentos"
            description="Tente novamente para revisar o acervo documental deste imóvel."
            tone="subtle"
            density="spacious"
            actions={
              <Button variant="outline" asChild>
                <Link href={`/properties/${propertyId}/documents`}>Abrir documentos</Link>
              </Button>
            }
          />
        ) : documentsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, index) => <div key={index} className="hl-skeleton h-24 rounded-[var(--hl-radius-lg)]" />)}
          </div>
        ) : documents.length > 0 ? (
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              {documents.slice(0, 6).map((document) => (
                <Link key={document.id} href={`/properties/${propertyId}/documents`} className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle transition-colors hover:bg-hl-surface-muted">
                  <p className="truncate text-sm font-medium text-hl-text">{document.title}</p>
                  <p className="mt-1 text-xs text-hl-text-muted">{formatDate(document.created_at)}</p>
                </Link>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <Link href={`/properties/${propertyId}/documents`}>Abrir documentos</Link>
              </Button>
            </div>
          </div>
        ) : (
          <PropertyEmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Sem documentos"
            description="Envie arquivos técnicos para formar a memória documental do imóvel."
            href={`/properties/${propertyId}/documents`}
            actionLabel="Abrir documentos"
          />
        )}
      </PageSection>
    </div>
  );
}

function PropertyWarrantiesPanel({
  propertyId,
  warranties,
  expiring,
  isLoading,
}: {
  propertyId: string;
  warranties: Warranty[];
  expiring: PropertyDashboard['warranties_expiring'];
  isLoading: boolean;
}) {
  const activeCount = warranties.filter((warranty) => warranty.status === 'active').length;

  return (
    <PageSection title="Garantias" description="Cobertura técnica, vigências e vencimentos próximos." tone="surface" density="editorial">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={ShieldCheck} label="Ativas" value={activeCount} helper="cobertura vigente" tone="success" density="compact" />
        <MetricCard icon={ShieldAlert} label="A vencer" value={expiring.length} helper="próximos 30 dias" tone="warning" density="compact" />
        <MetricCard icon={CheckCircle2} label="Total" value={warranties.length} helper="carregadas no painel" tone="default" density="compact" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => <div key={index} className="hl-skeleton h-24 rounded-[var(--hl-radius-lg)]" />)}
        </div>
      ) : warranties.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {warranties.slice(0, 6).map((warranty) => (
            <article key={warranty.id} className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
              <p className="truncate text-sm font-medium text-hl-text">{warranty.title}</p>
              <p className="mt-1 text-xs text-hl-text-muted">
                {warranty.provider_name ?? 'Fornecedor não informado'} · vence em {formatDate(warranty.end_date)}
              </p>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${propertyId}/warranties`}>Abrir garantias</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <PropertyEmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Nenhuma garantia carregada"
          description="As garantias aparecem aqui quando houver registros vinculados ao imóvel."
          href={`/properties/${propertyId}/warranties`}
          actionLabel="Abrir garantias"
        />
      )}
    </PageSection>
  );
}

function PropertyInventoryPanel({
  propertyId,
  items,
  isLoading,
}: {
  propertyId: string;
  items: InventoryItem[];
  isLoading: boolean;
}) {
  const lowStockCount = items.filter((item) => item.quantity <= item.reserve_qty).length;

  return (
    <PageSection title="Inventário" description="Itens e materiais associados ao imóvel." tone="surface" density="editorial">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Package} label="Itens" value={items.length} helper="carregados no painel" tone="default" density="compact" />
        <MetricCard icon={AlertTriangle} label="Baixo estoque" value={lowStockCount} helper="abaixo do mínimo" tone="warning" density="compact" />
        <MetricCard icon={ShieldCheck} label="Com garantia" value={items.filter((item) => Boolean(item.warranty_until)).length} helper="vigência registrada" tone="success" density="compact" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, index) => <div key={index} className="hl-skeleton h-28 rounded-[var(--hl-radius-lg)]" />)}
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item) => (
            <article key={item.id} className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
              <p className="truncate text-sm font-medium text-hl-text">{item.name}</p>
              <p className="mt-1 text-xs text-hl-text-muted">
                {item.quantity} {item.unit} · {INVENTORY_CATEGORY_LABELS[item.category] ?? item.category}
              </p>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/properties/${propertyId}/inventory`}>Abrir inventário</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <PropertyEmptyState
          icon={<Package className="h-6 w-6" />}
          title="Nenhum item de inventário"
          description="Os itens do inventário aparecem aqui quando já estiverem cadastrados para o imóvel."
          href={`/properties/${propertyId}/inventory`}
          actionLabel="Abrir inventário"
        />
      )}
    </PageSection>
  );
}

function PropertyHandoverPanel({ propertyId }: { propertyId: string }) {
  return <PremiumPropertyDashboard propertyId={propertyId} />;
}

function ProfileInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[var(--hl-radius-md)] bg-hl-surface-soft px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-hl-text-muted">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm font-medium text-hl-text">{value}</dd>
    </div>
  );
}

// ─── system icon map ──────────────────────────────────────────────────────────

const SYSTEM_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  electrical:    Zap,
  plumbing:      Droplets,
  structural:    Layers,
  waterproofing: Umbrella,
  painting:      Paintbrush,
  flooring:      Grid2x2,
  roofing:       Home,
  general:       Settings,
};

const SYSTEM_ACCENT: Record<string, string> = {
  electrical:    'bg-bg-warning text-text-warning',
  plumbing:      'bg-bg-info text-text-info',
  structural:    'bg-bg-subtle text-text-secondary',
  waterproofing: 'bg-bg-info text-text-info',
  painting:      'bg-bg-accent-subtle text-text-accent',
  flooring:      'bg-bg-warning text-text-warning',
  roofing:       'bg-bg-danger text-text-danger',
  general:       'bg-bg-subtle text-text-tertiary',
};

// ─── tab types ────────────────────────────────────────────────────────────────

type Tab = PropertyDetailTabId;

type PropertyProfileTab = {
  id: PropertyDetailTabId;
  label: string;
};

type ProfileMetric = {
  label: string;
  value: string | number;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
};

type SmartRecordState = 'empty' | 'pending' | 'ready' | 'error';

type SmartRecordView = {
  state: SmartRecordState;
  label: string;
  helper: string;
  toneClass: string;
  iconClass: string;
  reviewHref: string;
};

type IngestionSummaryStatus = {
  summary: PropertyDocumentIngestionSummary | null;
  isLoading: boolean;
  hasError: boolean;
};

type PredictiveTimelineBucket = 'now' | 'next30' | 'next90' | 'recent';
type PredictiveTimelinePriority = 'high' | 'medium' | 'low';

type PredictiveTimelineEvent = {
  id: string;
  bucket: PredictiveTimelineBucket;
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  priority: PredictiveTimelinePriority;
  date: string | null;
  dateLabel: string | null;
};

type PredictiveTimelineInput = {
  propertyId: string;
  summary: PropertyDocumentIngestionSummary | null;
  maintenanceSchedules: MaintenanceSchedule[];
  expiringWarranties: PropertyDashboard['warranties_expiring'];
};

const PREDICTIVE_TIMELINE_BUCKETS: {
  id: PredictiveTimelineBucket;
  label: string;
  helper: string;
}[] = [
  { id: 'now', label: 'Agora', helper: 'Pendências e prazos que pedem decisão imediata.' },
  { id: 'next30', label: 'Próximos 30 dias', helper: 'Cuidados e vencimentos de curto prazo.' },
  { id: 'next90', label: 'Próximos 90 dias', helper: 'Sinais para planejamento preventivo.' },
  { id: 'recent', label: 'Histórico recente', helper: 'Movimentos técnicos já registrados no prontuário.' },
];

function summaryMetric(value: number, summary: PropertyDocumentIngestionSummary | null, isLoading: boolean): string {
  if (isLoading) return '...';
  if (!summary) return '-';
  return String(value);
}

function getPendingCount(summary: PropertyDocumentIngestionSummary | null): number {
  if (!summary) return 0;
  return summary.pendingExtractionReviews + summary.pendingCandidates + summary.failedJobs;
}

function plural(count: number, singular: string, pluralLabel: string): string {
  return count === 1 ? singular : pluralLabel;
}

function daysUntil(dateStr: string): number | null {
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function timelineBucketFromDays(days: number): PredictiveTimelineBucket | null {
  if (days <= 0) return 'now';
  if (days <= 30) return 'next30';
  if (days <= 90) return 'next90';
  return null;
}

function priorityFromDays(days: number): PredictiveTimelinePriority {
  if (days <= 7) return 'high';
  if (days <= 30) return 'medium';
  return 'low';
}

function dueDateLabel(date: string | null, days: number | null): string | null {
  if (!date) return null;
  if (days !== null && days <= 0) return 'Hoje';
  return formatDate(date);
}

function buildPredictiveTimeline(input: PredictiveTimelineInput): Record<PredictiveTimelineBucket, PredictiveTimelineEvent[]> {
  const documentsHref = `/properties/${input.propertyId}/documents`;
  const maintenanceHref = `/properties/${input.propertyId}/maintenance`;
  const inventoryHref = `/properties/${input.propertyId}/inventory`;
  const timeline: Record<PredictiveTimelineBucket, PredictiveTimelineEvent[]> = {
    now: [],
    next30: [],
    next90: [],
    recent: [],
  };

  const addEvent = (event: PredictiveTimelineEvent) => {
    timeline[event.bucket].push(event);
  };

  const summary = input.summary;
  if (summary) {
    if (summary.pendingExtractionReviews > 0 || summary.needsReviewJobs > 0) {
      const count = summary.pendingExtractionReviews + summary.needsReviewJobs;
      addEvent({
        id: 'ingestion-review-pending',
        bucket: 'now',
        title: `${count} ${plural(count, 'revisão de extração pendente', 'revisões de extração pendentes')}`,
        description: 'Validar documentos analisados antes de aplicar dados ao prontuário.',
        href: documentsHref,
        icon: FileText,
        priority: 'high',
        date: null,
        dateLabel: null,
      });
    }

    if (summary.approvedCandidates > 0) {
      addEvent({
        id: 'approved-suggestions-pending-apply',
        bucket: 'now',
        title: `${summary.approvedCandidates} ${plural(summary.approvedCandidates, 'sugestão aguardando aplicação', 'sugestões aguardando aplicação')}`,
        description: 'Dados aprovados ainda não entraram no prontuário final do imóvel.',
        href: documentsHref,
        icon: Sparkles,
        priority: 'high',
        date: null,
        dateLabel: null,
      });
    }

    if (summary.pendingCandidates > 0) {
      addEvent({
        id: 'suggestions-pending-review',
        bucket: 'now',
        title: `${summary.pendingCandidates} ${plural(summary.pendingCandidates, 'sugestão aguardando decisão', 'sugestões aguardando decisão')}`,
        description: 'Aprovar ou rejeitar sugestões antes de aplicar ao prontuário.',
        href: documentsHref,
        icon: ClipboardCheck,
        priority: 'medium',
        date: null,
        dateLabel: null,
      });
    }

    if (summary.documentsWithIngestion > 0 && summary.lastIngestionAt) {
      addEvent({
        id: 'documents-analyzed-recently',
        bucket: 'recent',
        title: `${summary.documentsWithIngestion} ${plural(summary.documentsWithIngestion, 'documento analisado', 'documentos analisados')}`,
        description: `${summary.appliedCandidates} ${plural(summary.appliedCandidates, 'dado aplicado', 'dados aplicados')} ao prontuário até agora.`,
        href: documentsHref,
        icon: CheckCircle2,
        priority: 'low',
        date: summary.lastIngestionAt,
        dateLabel: formatDate(summary.lastIngestionAt),
      });
    }
  }

  input.maintenanceSchedules.forEach((schedule) => {
    if (!schedule.next_due) return;
    const dueInDays = schedule.days_until_due ?? daysUntil(schedule.next_due);
    if (dueInDays === null) return;
    const bucket = schedule.is_overdue ? 'now' : timelineBucketFromDays(dueInDays);
    if (!bucket) return;

    addEvent({
      id: `maintenance-${schedule.id}`,
      bucket,
      title: schedule.is_overdue ? `Manutenção atrasada: ${schedule.title}` : schedule.title,
      description: schedule.responsible
        ? `Responsável: ${schedule.responsible}. Frequência: ${schedule.frequency}.`
        : `Frequência: ${schedule.frequency}.`,
      href: maintenanceHref,
      icon: RefreshCw,
      priority: schedule.is_overdue ? 'high' : priorityFromDays(dueInDays),
      date: schedule.next_due,
      dateLabel: dueDateLabel(schedule.next_due, dueInDays),
    });
  });

  input.expiringWarranties.forEach((warranty) => {
    const bucket = timelineBucketFromDays(warranty.days_left);
    if (!bucket) return;

    addEvent({
      id: `warranty-${warranty.id}`,
      bucket,
      title: `Garantia a vencer: ${warranty.name}`,
      description: warranty.days_left <= 0
        ? 'Verificar cobertura hoje antes de perder o prazo.'
        : `Vence em ${warranty.days_left} dia${warranty.days_left === 1 ? '' : 's'}.`,
      href: inventoryHref,
      icon: ShieldCheck,
      priority: priorityFromDays(warranty.days_left),
      date: warranty.warranty_until,
      dateLabel: dueDateLabel(warranty.warranty_until, warranty.days_left),
    });
  });

  PREDICTIVE_TIMELINE_BUCKETS.forEach((bucket) => {
    timeline[bucket.id].sort((a, b) => {
      const priorityOrder: Record<PredictiveTimelinePriority, number> = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  });

  return timeline;
}

function resolveSmartRecordView(
  propertyId: string,
  summary: PropertyDocumentIngestionSummary | null,
  hasError: boolean
): SmartRecordView {
  const documentsHref = `/properties/${propertyId}/documents`;

  if (hasError) {
    return {
      state: 'error',
      label: 'Erro ao carregar',
      helper: 'Não foi possível consultar o prontuário inteligente agora.',
      toneClass: 'border-border-danger bg-bg-danger',
      iconClass: 'bg-bg-danger text-text-danger',
      reviewHref: documentsHref,
    };
  }

  if (summary && summary.pendingCandidates > 0) {
    return {
      state: 'pending',
      label: 'Sugestões aguardando revisão',
      helper: 'Há dados extraídos esperando decisão antes de entrar no prontuário.',
      toneClass: 'border-border-warning bg-bg-warning',
      iconClass: 'bg-bg-warning-emphasis text-text-warning',
      reviewHref: documentsHref,
    };
  }

  if (
    summary &&
    (summary.pendingExtractionReviews > 0 ||
      summary.needsReviewJobs > 0 ||
      summary.processingJobs > 0 ||
      summary.failedJobs > 0)
  ) {
    return {
      state: 'pending',
      label: 'Análises pendentes',
      helper: summary.processingJobs > 0
        ? 'Uma análise está em andamento. Acompanhe antes de aplicar dados ao imóvel.'
        : 'Existem extrações que precisam de revisão para liberar próximas etapas.',
      toneClass: 'border-border-accent bg-bg-accent-subtle',
      iconClass: 'bg-bg-accent text-text-inverse',
      reviewHref: documentsHref,
    };
  }

  if (summary && summary.documentsWithIngestion > 0) {
    return {
      state: 'ready',
      label: 'Tudo em dia',
      helper: 'As análises disponíveis não têm pendências de revisão.',
      toneClass: 'border-border-success bg-bg-success',
      iconClass: 'bg-bg-success-emphasis text-text-success',
      reviewHref: documentsHref,
    };
  }

  return {
    state: 'empty',
    label: summary && summary.totalDocuments > 0 ? 'Sem documentos analisados' : 'Sem documentos',
    helper: summary && summary.totalDocuments > 0
      ? 'Comece analisando os documentos técnicos já enviados.'
      : 'Envie o primeiro documento técnico para iniciar o prontuário.',
    toneClass: 'border-border-subtle bg-[var(--surface-base)]',
    iconClass: 'bg-bg-subtle text-text-accent',
    reviewHref: documentsHref,
  };
}

function TechnicalHealthPanel({
  propertyId,
  healthScore,
  technicalHealth,
  summary,
  isLoading,
  hasError,
}: IngestionSummaryStatus & {
  propertyId: string;
  healthScore: number | null;
  technicalHealth: PropertyTechnicalHealthView;
}) {
  const hasHealthScore = typeof healthScore === 'number' && Number.isFinite(healthScore);
  const pendingCount = getPendingCount(summary);
  const score = hasHealthScore ? healthScore : 0;

  return (
    <section className="rounded-[var(--radius-2xl)] bg-[var(--surface-base)] p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-bg-accent-subtle text-text-accent">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">Saúde técnica do imóvel</p>
              <h2 className="mt-1 text-xl font-light leading-tight text-text-primary sm:text-2xl">
                {hasHealthScore ? `${score}/100` : 'Em formação'}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-text-secondary">
            {hasHealthScore
              ? `${technicalHealth.label}. ${technicalHealth.description}`
              : technicalHealth.description}
          </p>

          {hasHealthScore ? (
            <div className="mt-4">
              <ScoreBar score={score} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/properties/${propertyId}/documents`}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Abrir documentos
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/properties/${propertyId}/maintenance`}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Ver manutenção
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <MetricCard
            label="Documentos analisados"
            value={summaryMetric(summary?.documentsWithIngestion ?? 0, summary, isLoading)}
            helper={hasError ? 'Não foi possível atualizar agora' : 'Base técnica lida pelo prontuário'}
            icon={FileText}
            density="compact"
          />
          <MetricCard
            label="Sugestões pendentes"
            value={summaryMetric(summary?.pendingCandidates ?? 0, summary, isLoading)}
            helper="Aguardam revisão humana"
            icon={Sparkles}
            tone={summary && summary.pendingCandidates > 0 ? 'warning' : 'default'}
            density="compact"
          />
          <MetricCard
            label="Dados aplicados"
            value={summaryMetric(summary?.appliedCandidates ?? 0, summary, isLoading)}
            helper="Entraram no prontuário"
            icon={CheckCircle2}
            tone="success"
            density="compact"
          />
          <MetricCard
            label="Falhas de análise"
            value={summaryMetric(summary?.failedJobs ?? 0, summary, isLoading)}
            helper={pendingCount > 0 ? 'Requer atenção' : 'Sem bloqueios'}
            icon={AlertTriangle}
            tone={summary && summary.failedJobs > 0 ? 'danger' : 'default'}
            density="compact"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-xl)] bg-bg-success p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-text-success" aria-hidden="true" />
            <p className="text-sm font-semibold text-text-primary">Sinais positivos</p>
          </div>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
            {technicalHealth.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-xl)] bg-bg-warning p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-text-warning" aria-hidden="true" />
            <p className="text-sm font-semibold text-text-primary">Pontos de atenção</p>
          </div>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
            {technicalHealth.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--radius-xl)] bg-bg-accent-subtle p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-text-accent" aria-hidden="true" />
            <p className="text-sm font-semibold text-text-primary">Como melhorar</p>
          </div>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
            {technicalHealth.improvements.map((improvement) => (
              <li key={improvement}>{improvement}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SmartRecordWidget({ propertyId, summary, isLoading, hasError }: { propertyId: string } & IngestionSummaryStatus) {
  const documentsHref = `/properties/${propertyId}/documents`;
  const view = resolveSmartRecordView(propertyId, summary, hasError);
  const metricValue = (value: number): string => {
    return summaryMetric(value, summary, isLoading);
  };
  const StatusIcon = view.state === 'error' ? AlertTriangle : Sparkles;

  return (
    <PageSection
      title="Prontuário inteligente"
      description="Use documentos técnicos para preencher automaticamente o histórico do imóvel."
      tone="strong"
      density="editorial"
      actions={
        <Badge className={cn('border', view.toneClass)}>
          {isLoading ? 'Atualizando' : view.label}
        </Badge>
      }
    >
      <div className={cn('rounded-[var(--radius-xl)] border p-4 sm:p-5', view.toneClass)}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 gap-4">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)]', view.iconClass)}>
              <StatusIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{view.label}</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">{view.helper}</p>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">Documentos analisados</p>
                  <p className="mt-1 text-lg font-light tabular-nums text-text-primary">
                    {metricValue(summary?.documentsWithIngestion ?? 0)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">Análises pendentes</p>
                  <p className="mt-1 text-lg font-light tabular-nums text-text-primary">
                    {metricValue((summary?.pendingExtractionReviews ?? 0) + (summary?.needsReviewJobs ?? 0))}
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">Sugestões em revisão</p>
                  <p className="mt-1 text-lg font-light tabular-nums text-text-primary">
                    {metricValue(summary?.pendingCandidates ?? 0)}
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">Dados aplicados</p>
                  <p className="mt-1 text-lg font-light tabular-nums text-text-primary">
                    {metricValue(summary?.appliedCandidates ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button asChild>
              <Link href={documentsHref}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Enviar documento
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={view.reviewHref}>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Revisar análises
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={documentsHref}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Ver documentos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageSection>
  );
}

function TechnicalPendingPanel({ propertyId, summary, isLoading, hasError }: { propertyId: string } & IngestionSummaryStatus) {
  type PendingPriority = 'critica' | 'alta' | 'media' | 'baixa';
  type PendingItem = {
    id: string;
    label: string;
    value: number;
    helper: string;
    priority: PendingPriority;
    cta: 'Revisar extrações' | 'Revisar sugestões' | 'Aplicar sugestões' | 'Ver falhas' | 'Enviar documento';
    href: string;
  };

  const documentsHref = `/properties/${propertyId}/documents`;
  const priorityOrder: Record<PendingPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
  const priorityLabels: Record<PendingPriority, string> = {
    critica: 'Crítica',
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa',
  };
  const priorityStyles: Record<PendingPriority, string> = {
    critica: 'border-border-danger bg-bg-danger text-text-danger',
    alta: 'border-border-warning bg-bg-warning text-text-warning',
    media: 'border-border-accent bg-bg-accent-subtle text-text-accent',
    baixa: 'border-border-subtle bg-bg-subtle text-text-secondary',
  };

  const pendingItems: PendingItem[] = [];

  if (!summary || summary.documentsWithIngestion === 0) {
    pendingItems.push({
      id: 'documents-without-analysis',
      label: summary && summary.totalDocuments > 0 ? 'Documentos sem análise registrada' : 'Nenhum documento analisado',
      value: 1,
      helper: summary && summary.totalDocuments > 0
        ? 'Há documentos no acervo que ainda não entraram na trilha de análise.'
        : 'O prontuário técnico ainda precisa do primeiro documento analisado.',
      priority: 'baixa',
      cta: 'Enviar documento',
      href: documentsHref,
    });
  }

  if (summary?.failedJobs) {
    pendingItems.push({
      id: 'failed-jobs',
      label: 'Análises com falha',
      value: summary.failedJobs,
      helper: 'Revise as falhas antes de confiar nos dados extraídos.',
      priority: 'critica',
      cta: 'Ver falhas',
      href: documentsHref,
    });
  }

  const reviewCount = (summary?.pendingExtractionReviews ?? 0) + (summary?.needsReviewJobs ?? 0);
  if (reviewCount > 0) {
    pendingItems.push({
      id: 'pending-reviews',
      label: 'Extrações aguardando revisão',
      value: reviewCount,
      helper: 'Confirme ou rejeite os dados extraídos antes de avançar.',
      priority: 'alta',
      cta: 'Revisar extrações',
      href: documentsHref,
    });
  }

  if (summary?.pendingCandidates) {
    pendingItems.push({
      id: 'pending-candidates',
      label: 'Sugestões aguardando decisão',
      value: summary.pendingCandidates,
      helper: 'Aprove ou rejeite as sugestões antes de aplicar ao prontuário.',
      priority: 'media',
      cta: 'Revisar sugestões',
      href: documentsHref,
    });
  }

  if (summary?.approvedCandidates) {
    pendingItems.push({
      id: 'approved-candidates',
      label: 'Sugestões aprovadas ainda não aplicadas',
      value: summary.approvedCandidates,
      helper: 'Finalize a aplicação para criar registros reais do imóvel.',
      priority: 'media',
      cta: 'Aplicar sugestões',
      href: documentsHref,
    });
  }

  const visibleItems = pendingItems
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 4);
  const pendingTotal = pendingItems.reduce((sum, item) => sum + item.value, 0);
  const hasCriticalPending = pendingItems.some((item) => item.priority === 'critica' || item.priority === 'alta');
  const shellTone = hasError
    ? 'border-border-danger bg-bg-danger'
    : hasCriticalPending
      ? 'border-border-warning bg-bg-warning'
      : pendingTotal > 0
        ? 'border-border-accent bg-bg-accent-subtle'
        : 'border-border-success bg-bg-success';

  return (
    <PageSection
      title="Pendências técnicas"
      description="O que precisa de ação para manter a análise documental do imóvel confiável."
      tone="strong"
      density="editorial"
      actions={
        <Badge className={cn('border', shellTone)}>
          {isLoading ? 'Atualizando' : `${pendingTotal} pendência${pendingTotal === 1 ? '' : 's'}`}
        </Badge>
      }
    >
      {hasError ? (
        <div className="flex min-h-20 items-start gap-3 rounded-[var(--radius-xl)] border border-border-danger bg-bg-danger px-4 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-text-danger" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-primary">Não foi possível carregar as pendências</span>
            <span className="mt-0.5 block text-xs leading-5 text-text-secondary">Tente novamente em instantes ou acesse documentos.</span>
          </span>
        </div>
      ) : isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      ) : visibleItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex min-h-28 flex-col justify-between gap-4 rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-4 py-4 transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-text-secondary">{item.helper}</span>
                </span>
                <span className="shrink-0 text-2xl font-light tabular-nums text-text-primary">{item.value}</span>
              </span>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium', priorityStyles[item.priority])}>
                  Prioridade {priorityLabels[item.priority]}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-text-accent group-hover:underline">
                  {item.cta}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex min-h-20 items-start gap-3 rounded-[var(--radius-xl)] border border-border-success bg-bg-success px-4 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-text-success" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-primary">Nenhuma ação técnica pendente</span>
            <span className="mt-0.5 block text-xs leading-5 text-text-secondary">
              As análises disponíveis estão revisadas e sem sugestões aguardando aplicação.
            </span>
          </span>
        </div>
      )}
    </PageSection>
  );
}

function SmartRecordEmptyPrompt({ propertyId, summary, isLoading }: { propertyId: string } & Pick<IngestionSummaryStatus, 'summary' | 'isLoading'>) {
  if (isLoading || !summary || (summary.totalDocuments > 0 && summary.documentsWithIngestion > 0)) return null;

  const suggestions = ['Manual do proprietário', 'Nota fiscal', 'Planta', 'Relatório técnico'];

  return (
    <PageSection
      title="Comece pelo acervo técnico"
      description="Poucos documentos bem escolhidos reduzem digitação manual e aceleram a formação do prontuário."
      tone="surface"
      density="editorial"
      actions={
        <Button asChild>
          <Link href={`/properties/${propertyId}/documents`}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Enviar documento
          </Link>
        </Button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {suggestions.map((suggestion) => (
          <div key={suggestion} className="flex min-h-16 items-center gap-3 rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-4 py-3">
            <FileText className="h-4 w-4 shrink-0 text-text-accent" aria-hidden="true" />
            <span className="text-sm font-medium text-text-primary">{suggestion}</span>
          </div>
        ))}
      </div>
    </PageSection>
  );
}

// ─── systems tab ─────────────────────────────────────────────────────────────

function priorityLabel(priority: PredictiveTimelinePriority): string {
  switch (priority) {
    case 'high':
      return 'Alta';
    case 'medium':
      return 'Média';
    case 'low':
      return 'Baixa';
    default:
      return 'Baixa';
  }
}

function priorityClass(priority: PredictiveTimelinePriority): string {
  switch (priority) {
    case 'high':
      return 'border-border-danger bg-bg-danger text-text-danger';
    case 'medium':
      return 'border-border-warning bg-bg-warning text-text-warning';
    case 'low':
      return 'border-border-subtle bg-bg-subtle text-text-secondary';
    default:
      return 'border-border-subtle bg-bg-subtle text-text-secondary';
  }
}

function PredictiveTimelineSection({
  propertyId,
  timeline,
  isLoading,
  hasError,
}: {
  propertyId: string;
  timeline: Record<PredictiveTimelineBucket, PredictiveTimelineEvent[]>;
  isLoading: boolean;
  hasError: boolean;
}) {
  const totalEvents = PREDICTIVE_TIMELINE_BUCKETS.reduce((total, bucket) => total + timeline[bucket.id].length, 0);

  return (
    <PageSection
      title="Linha do tempo preditiva"
      description="Próximos cuidados, pendências e eventos técnicos derivados dos sinais já disponíveis."
      tone="strong"
      density="editorial"
      actions={
        <Badge className={cn('border', totalEvents > 0 ? 'border-border-accent bg-bg-accent-subtle text-text-accent' : 'border-border-subtle bg-bg-subtle text-text-secondary')}>
          {isLoading ? 'Atualizando' : totalEvents > 0 ? `${totalEvents} sinal${totalEvents > 1 ? 's' : ''}` : 'Sem sinais'}
        </Badge>
      }
    >
      {hasError ? (
        <div className="flex min-h-20 items-start gap-3 rounded-[var(--radius-xl)] bg-bg-danger px-4 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-text-danger" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-primary">Não foi possível atualizar a linha do tempo</span>
            <span className="mt-0.5 block text-xs leading-5 text-text-secondary">Os dados existentes continuam preservados nos módulos de origem.</span>
          </span>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="hl-skeleton h-44 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      ) : totalEvents > 0 ? (
        <div className="grid gap-3 lg:grid-cols-4">
          {PREDICTIVE_TIMELINE_BUCKETS.map((bucket) => {
            const events = timeline[bucket.id];

            return (
              <section key={bucket.id} className="min-h-44 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary">{bucket.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-text-tertiary">{bucket.helper}</span>
                  </span>
                  <span className="shrink-0 text-lg font-light tabular-nums text-text-secondary">{events.length}</span>
                </div>

                {events.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {events.slice(0, 3).map((event) => {
                      const Icon = event.icon;

                      return (
                        <Link
                          key={event.id}
                          href={event.href}
                          className="block rounded-[var(--radius-lg)] border border-border-subtle bg-bg-subtle px-3 py-3 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
                        >
                          <div className="flex items-start gap-2.5">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-accent" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium leading-5 text-text-primary">{event.title}</span>
                              <span className="mt-1 block text-xs leading-5 text-text-secondary">{event.description}</span>
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]', priorityClass(event.priority))}>
                              {priorityLabel(event.priority)}
                            </span>
                            {event.dateLabel ? (
                              <span className="text-[11px] font-medium text-text-tertiary">{event.dateLabel}</span>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })}
                    {events.length > 3 ? (
                      <p className="px-1 text-xs font-medium text-text-tertiary">e mais {events.length - 3}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-border-subtle px-3 py-4">
                    <p className="text-xs leading-5 text-text-tertiary">Sem eventos para este período com os dados atuais.</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">Ainda não há sinais suficientes para montar a linha do tempo</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              Envie e analise documentos técnicos para revelar revisões pendentes, sugestões aplicáveis e dados recentes do prontuário.
            </p>
          </div>
          <Button asChild>
            <Link href={`/properties/${propertyId}/documents`}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Abrir documentos
            </Link>
          </Button>
        </div>
      )}
    </PageSection>
  );
}

type SystemSummary = {
  type: string;
  total: number;
  completed: number;
  lastDate: string | null;
};

function SystemsTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useSWR<{ data: ServiceOrder[]; has_more: boolean }>(
    `/properties/${propertyId}/services?limit=100`,
    apiFetcher as (url: string) => Promise<{ data: ServiceOrder[]; has_more: boolean }>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="hl-skeleton h-16 rounded-[var(--radius-xl)]" />
        ))}
      </div>
    );
  }

  const orders = data?.data ?? [];

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Settings className="mb-3 h-8 w-8 text-text-tertiary" />
        <p className="text-sm text-text-tertiary">Nenhuma OS registrada ainda.</p>
        <p className="mt-1 text-xs text-text-tertiary">Os sistemas aparecerão conforme as ordens forem criadas.</p>
      </div>
    );
  }

  // Aggregate by system_type
  const map = new Map<string, SystemSummary>();
  for (const o of orders) {
    const existing = map.get(o.system_type) ?? { type: o.system_type, total: 0, completed: 0, lastDate: null };
    existing.total += 1;
    if (o.status === 'completed' || o.status === 'verified') {
      existing.completed += 1;
      const d = o.completed_at ?? o.created_at;
      if (!existing.lastDate || d > existing.lastDate) existing.lastDate = d;
    }
    map.set(o.system_type, existing);
  }

  const systems = [...map.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-2">
      {systems.map((s) => {
        const Icon = SYSTEM_ICONS[s.type] ?? Settings;
        const accentClass = SYSTEM_ACCENT[s.type] ?? 'bg-bg-subtle text-text-tertiary';
        const health = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        return (
          <div
            key={s.type}
            className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4"
          >
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]', accentClass)}>
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {SYSTEM_TYPE_LABELS[s.type] ?? s.type}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
                  {s.lastDate ? formatDate(s.lastDate) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', scoreBg(health))}
                    style={{ width: `${health}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-tertiary">
                  {s.completed}/{s.total} OS
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── timeline preview ─────────────────────────────────────────────────────────

function TimelinePreview({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useSWR<{ data: ServiceOrder[] }>(
    `/properties/${propertyId}/services?status=completed&limit=5`,
    apiFetcher as (url: string) => Promise<{ data: ServiceOrder[] }>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
        ))}
      </div>
    );
  }

  const orders = [...(data?.data ?? [])].sort((a, b) => {
    const dA = a.completed_at ?? a.created_at;
    const dB = b.completed_at ?? b.created_at;
    return dB.localeCompare(dA);
  });

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GitBranch className="mb-3 h-8 w-8 text-text-tertiary" />
        <p className="text-sm text-text-tertiary">Nenhum evento registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative space-y-5 pl-7">
        <div className="absolute bottom-0 left-2.5 top-0 w-px bg-border-subtle" />
        {orders.map((o) => {
          const dotColor = o.system_type === 'electrical' ? 'var(--text-warning)'
            : o.system_type === 'plumbing' ? 'var(--interactive-primary-bg)'
            : o.system_type === 'roofing' ? 'var(--text-danger)'
            : 'var(--text-success)';
          return (
            <div key={o.id} className="relative">
              <div
                className="absolute -left-[1.15rem] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--bg-page)]"
                style={{ background: dotColor }}
              />
              <p className="mb-1 text-xs text-text-tertiary">
                {formatDate(o.completed_at ?? o.created_at)}
              </p>
              <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-text-primary">{o.title}</p>
                    {o.assigned_to_name && (
                      <p className="mt-0.5 text-xs text-text-tertiary">{o.assigned_to_name}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-bg-success px-2.5 py-0.5 text-xs font-medium text-text-success">
                    {SYSTEM_TYPE_LABELS[o.system_type] ?? o.system_type}
                  </span>
                </div>
                {o.cost != null && (
                  <p className="mt-2 text-xs text-text-tertiary">
                    Custo: <span className="text-text-secondary">{formatCurrency(o.cost)}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href={`/properties/${propertyId}/timeline`}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-border-default py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
      >
        <GitBranch className="h-4 w-4" />
        Ver linha do tempo completa
      </Link>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const activeTab = normalizePropertyDetailTab(searchParams.get('tab'));

  const { data: propData, isLoading: propLoading } = useSWR(['property', id], () => propertiesApi.get(id));
  const { data: dash, error: dashError, isLoading: dashLoading, mutate: mutateDashboard } = useSWR(['dashboard', id], () => propertiesApi.dashboard(id));
  const { data: roomsPreviewData, isLoading: roomsPreviewLoading } = useSWR(['property-rooms-preview', id], () => roomsApi.list(id));
  const { data: maintenanceData, isLoading: maintenanceLoading } = useSWR(['maintenance', id], () => maintenanceApi.list(id));
  const {
    data: propertySummaryData,
    error: propertySummaryError,
    isLoading: propertySummaryLoading,
  } = useSWR(['property-ingestion-summary', id], () => documentIngestionApi.propertySummary(id));
  const {
    data: documentsPreviewData,
    error: documentsPreviewError,
    isLoading: documentsPreviewLoading,
  } = useSWR(['property-documents-preview', id], () => documentsApi.list(id));
  const { data: inventoryPreviewData, isLoading: inventoryPreviewLoading } = useSWR(
    ['property-inventory-preview', id],
    () => inventoryApi.list(id)
  );
  const { data: warrantiesPreviewData, isLoading: warrantiesPreviewLoading } = useSWR(
    ['property-warranties-preview', id],
    () => warrantiesApi.list(id)
  );
  const { data: serviceOrdersPreviewData, isLoading: serviceOrdersPreviewLoading } = useSWR(
    ['property-services-preview', id],
    () => servicesApi.list(id)
  );
  const { data: requestsPreviewData, isLoading: requestsPreviewLoading } = useSWR(
    ['property-service-requests-preview', id],
    () => serviceRequestsApi.list(id, { limit: 5 })
  );

  if (propLoading) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-4 px-4 py-4 sm:px-5">
        <div className="hl-skeleton h-44 rounded-[var(--radius-2xl)]" />
        <div className="hl-skeleton h-11 rounded-[var(--radius-xl)]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      </div>
    );
  }

  const property = propData?.property;

  if (!property) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-4 sm:px-5">
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Imóvel não encontrado"
          description="O ativo pode ter sido removido ou você pode não ter acesso a este prontuário técnico."
          actions={
            <Button asChild variant="outline">
              <Link href="/properties">Voltar aos imóveis</Link>
            </Button>
          }
          tone="strong"
          density="spacious"
        />
      </div>
    );
  }

  const d = dash;
  const propertySummary = propertySummaryData?.summary ?? null;
  const technicalHealth = buildPropertyTechnicalHealthView(
    { health_score: d?.health_score ?? property.health_score },
    propertySummary
  );
  const healthScore = technicalHealth.score;
  const healthScoreClass = healthScore === null ? 'text-text-secondary' : scoreColor(healthScore);
  const ingestionStatus: IngestionSummaryStatus = {
    summary: propertySummary,
    isLoading: propertySummaryLoading,
    hasError: Boolean(propertySummaryError),
  };
  const totalEvents = (d?.services.total ?? 0);
  const memoriaEmDias = daysSince(property.created_at);
  const openOrders = (d?.services.requested ?? 0) + (d?.services.in_progress ?? 0);
  const urgentOrders = d?.services.urgent_open ?? 0;
  const overdueMaintenance = d?.maintenance.overdue ?? (maintenanceData?.schedules ?? []).filter((schedule) => schedule.is_overdue).length;
  const expiringWarranties = d?.warranties_expiring ?? [];
  const predictiveTimeline = buildPredictiveTimeline({
    propertyId: id,
    summary: propertySummary,
    maintenanceSchedules: maintenanceData?.schedules ?? [],
    expiringWarranties,
  });
  const currentMonthExpenses = d?.expenses.this_month ?? 0;
  const documentsPreview = documentsPreviewData?.data ?? [];
  const serviceOrdersPreview = serviceOrdersPreviewData?.data ?? [];
  const requestsPreview = requestsPreviewData?.data ?? [];
  const profileMetrics: ProfileMetric[] = [
    {
      label: 'Despesa mensal',
      value: formatCurrency(currentMonthExpenses),
      helper: 'Mes atual',
      icon: BarChart3,
    },
    {
      label: 'Chamados abertos',
      value: openOrders + requestsPreview.filter((request) => request.status === 'OPEN').length,
      helper: `${urgentOrders} urgentes`,
      icon: Wrench,
      tone: urgentOrders > 0 ? 'danger' : 'default',
    },
    {
      label: 'OS concluidas',
      value: d?.services.done ?? 0,
      helper: 'Historico executado',
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Itens inventario',
      value: d?.inventory.total ?? 0,
      helper: d && d.inventory.low_stock > 0 ? `${d.inventory.low_stock} em falta` : 'Tudo ok',
      icon: Package,
      tone: d && d.inventory.low_stock > 0 ? 'warning' : 'default',
    },
  ];
  const attentionItems = [
    ...(urgentOrders > 0
      ? [{ tone: 'danger' as const, icon: ShieldAlert, title: `${urgentOrders} OS urgente${urgentOrders > 1 ? 's' : ''}`, description: 'Priorize a triagem e a execução.' }]
      : []),
    ...(openOrders > 0
      ? [{ tone: 'accent' as const, icon: Wrench, title: `${openOrders} OS aberta${openOrders > 1 ? 's' : ''}`, description: 'Acompanhe solicitações e execuções.' }]
      : []),
    ...(overdueMaintenance > 0
      ? [{ tone: 'warning' as const, icon: RefreshCw, title: `${overdueMaintenance} manutenção atrasada${overdueMaintenance > 1 ? 's' : ''}`, description: 'Revise o plano preventivo.' }]
      : []),
    ...(expiringWarranties.length > 0
      ? [{ tone: 'warning' as const, icon: ShieldCheck, title: `${expiringWarranties.length} garantia${expiringWarranties.length > 1 ? 's' : ''} vencendo`, description: 'Verifique itens dentro de 30 dias.' }]
      : []),
    ...(currentMonthExpenses > 0
      ? [{ tone: 'success' as const, icon: BarChart3, title: formatCurrency(currentMonthExpenses), description: 'Despesa registrada neste mês.' }]
      : []),
  ];

  const profileTabs: PropertyProfileTab[] = PROPERTY_DETAIL_TABS.filter((tab) =>
    ['overview', 'rooms', 'tickets', 'services', 'history'].includes(tab.id)
  );
  const moduleGroups = buildPropertyModuleGroups(id);

  return (
    <div className="mx-auto min-h-full w-full min-w-0 max-w-[1180px] space-y-5 bg-hl-bg px-4 py-4 pb-[calc(var(--nav-height-bottom)+1.5rem+env(safe-area-inset-bottom))] text-hl-text sm:px-5 sm:py-5 md:pb-6 lg:px-8">
      <PropertyProfileHeader
        property={property}
        propertyId={id}
        healthScore={healthScore}
        technicalHealth={technicalHealth}
        openOrders={openOrders}
        urgentOrders={urgentOrders}
        memoriaEmDias={memoriaEmDias}
        totalEvents={totalEvents}
        onCreateOrder={() => setCreateOpen(true)}
      />

      <PropertyTabs propertyId={id} tabs={profileTabs} activeTab={activeTab} />

      <PropertyModuleBar groups={moduleGroups} activeTab={activeTab} />

      <PropertyMobileModulesMenu groups={moduleGroups} activeTab={activeTab} />

      {/* ── EDITORIAL HERO ──────────────────────────────────────────────── */}
      <div className="hidden">

        {/* Cover photo or gradient backdrop */}
        {property.cover_url ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${property.cover_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(247,245,240,0.10) 0%, rgba(247,245,240,0.72) 58%, rgba(247,245,240,0.98) 100%)' }} />
          </div>
        ) : (
          <div className="absolute inset-0 bg-hl-surface-muted" />
        )}

        <div className="relative z-10 px-4 pb-0 pt-4 sm:px-6 sm:pt-5 md:px-7 md:pt-6">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Link href="/properties" className="hover:text-text-secondary transition-colors">
                Meus imóveis
              </Link>
              <span>/</span>
              <Badge variant="secondary" className="text-xs">
                {PROPERTY_TYPE_LABELS[property.type]}
              </Badge>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/properties/${id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Link>
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Wrench className="h-3.5 w-3.5" />
                Nova OS
              </Button>
            </div>
          </div>

          {/* Property name */}
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
              Memória técnica viva
            </p>
            <h1 className="mt-2 text-3xl font-light leading-tight tracking-tight text-text-primary md:text-4xl">
              {property.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-start gap-x-1.5 gap-y-0.5 text-sm text-text-secondary">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              <span className="min-w-0 break-words">{property.address}, {property.city}</span>
              {(property.area_m2 || property.year_built) && (
                <span className="shrink-0 text-text-tertiary">
                  {property.area_m2 ? `· ${property.area_m2} m²` : ''}
                  {property.year_built ? ` · ${property.year_built}` : ''}
                </span>
              )}
            </p>
          </div>

          {/* Stats trio + health */}
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-border sm:grid-cols-4">
            {/* Saúde */}
            <div className="flex flex-col gap-1 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Saúde</p>
              <div className="flex items-baseline gap-1">
                <span className={cn('text-xl font-light tabular-nums sm:text-2xl', healthScoreClass)}>
                  {healthScore ?? 'Em formação'}
                </span>
                {healthScore !== null && <span className="text-xs text-text-tertiary">/100</span>}
              </div>
              <p className="text-[10px] text-text-tertiary">{technicalHealth.label}</p>
            </div>

            {/* Dias de memória */}
            <div className="flex flex-col gap-1 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Memória</p>
              <span className="text-xl font-light tabular-nums text-text-primary sm:text-2xl">
                {memoriaEmDias.toLocaleString('pt-BR')}
              </span>
              <p className="text-[10px] text-text-tertiary">dias rastreados</p>
            </div>

            {/* Eventos */}
            <div className="flex flex-col gap-1 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Eventos</p>
              <span className="text-xl font-light tabular-nums text-text-primary sm:text-2xl">
                {totalEvents}
              </span>
              <p className="text-[10px] text-text-tertiary">OS registradas</p>
            </div>

            {/* Health bar visual */}
            <div className="flex flex-col justify-between gap-1.5 bg-[var(--surface-base)] px-3 py-3 sm:px-4 sm:py-3.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-tertiary">Estado técnico</p>
              {healthScore === null ? (
                <p className="text-xs leading-5 text-text-tertiary">Aguardando documentos técnicos.</p>
              ) : (
                <ScoreBar score={healthScore} />
              )}
            </div>
          </div>

          </div>
        </div>

      {/* ── TAB: VISÃO GERAL ─────────────────────────────────────────────── */}
      <main className="min-w-0 space-y-6">
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <ExecutivePropertyDashboard
            propertyId={id}
            dashboard={dash}
            isLoading={dashLoading}
            hasError={Boolean(dashError)}
            onRetry={() => { void mutateDashboard(); }}
          />

          <PropertyOverviewPanel
            propertyId={id}
            property={property}
            documents={documentsPreview}
            documentsLoading={documentsPreviewLoading}
            documentsError={Boolean(documentsPreviewError)}
            serviceOrders={serviceOrdersPreview}
            requests={requestsPreview}
            operationsLoading={serviceOrdersPreviewLoading || requestsPreviewLoading}
          />

          <PropertySummaryCards metrics={profileMetrics} />

          <TechnicalHealthPanel
            propertyId={id}
            healthScore={healthScore}
            technicalHealth={technicalHealth}
            {...ingestionStatus}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
            <SmartRecordWidget propertyId={id} {...ingestionStatus} />
            <TechnicalPendingPanel propertyId={id} {...ingestionStatus} />
          </div>

          <SmartRecordEmptyPrompt propertyId={id} summary={propertySummary} isLoading={propertySummaryLoading} />

          <PredictiveTimelineSection
            propertyId={id}
            timeline={predictiveTimeline}
            isLoading={propertySummaryLoading || dashLoading || maintenanceLoading}
            hasError={Boolean(propertySummaryError)}
          />

          {/* Metrics */}
          <PageSection
            title="Operação atual"
            description="Leitura rápida do estado técnico e financeiro do ativo."
            tone="surface"
            density="editorial"
          >
            {dashLoading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
                ))}
              </div>
            ) : d ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Despesa mensal"
                  value={formatCurrency(d.expenses.this_month ?? 0)}
                  helper="Mês atual"
                  icon={BarChart3}
                  density="compact"
                />
                <MetricCard
                  label="OS abertas"
                  value={d.services.requested + d.services.in_progress}
                  helper={`${d.services.urgent_open} urgentes`}
                  icon={Wrench}
                  tone={d.services.urgent_open > 0 ? 'danger' : 'default'}
                  density="compact"
                />
                <MetricCard
                  label="OS concluídas"
                  value={d.services.done}
                  helper="Histórico executado"
                  icon={CheckCircle2}
                  tone="success"
                  density="compact"
                />
                <MetricCard
                  label="Itens inventário"
                  value={d.inventory.total}
                  helper={d.inventory.low_stock > 0 ? `${d.inventory.low_stock} em falta` : 'Tudo ok'}
                  icon={Package}
                  tone={d.inventory.low_stock > 0 ? 'warning' : 'default'}
                  density="compact"
                />
              </div>
            ) : null}
          </PageSection>

          <PageSection
            title="Atenção agora"
            description="Sinais operacionais que merecem revisão antes de navegar pelo prontuário."
            tone="strong"
            density="editorial"
          >
            {attentionItems.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {attentionItems.map((item) => {
                  const Icon = item.icon;
                  const href =
                    item.icon === BarChart3
                      ? `/properties/${id}/financial`
                      : item.icon === RefreshCw
                        ? `/properties/${id}/maintenance`
                        : item.icon === ShieldCheck
                          ? `/properties/${id}/inventory`
                          : `/properties/${id}/services`;

                  return (
                    <Link
                      key={`${item.title}-${item.description}`}
                      href={href}
                      className={cn(
                        'flex min-h-20 items-start gap-3 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                        item.tone === 'danger' && 'bg-bg-danger',
                        item.tone === 'warning' && 'bg-bg-warning',
                        item.tone === 'success' && 'bg-bg-success',
                        item.tone === 'accent' && 'bg-bg-accent-subtle'
                      )}
                    >
                      <Icon
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          item.tone === 'danger' && 'text-text-danger',
                          item.tone === 'warning' && 'text-text-warning',
                          item.tone === 'success' && 'text-text-success',
                          item.tone === 'accent' && 'text-text-accent'
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text-primary">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-text-secondary">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-20 items-start gap-3 rounded-[var(--radius-xl)] bg-bg-success px-4 py-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-text-success" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary">Imóvel sem alertas ativos</span>
                  <span className="mt-0.5 block text-xs leading-5 text-text-secondary">
                    Nenhum sinal operacional crítico identificado. Continue monitorando pelo prontuário técnico.
                  </span>
                </span>
              </div>
            )}
          </PageSection>

          {/* Warranties expiring */}
          {d?.warranties_expiring && d.warranties_expiring.length > 0 && (
            <PageSection
              title="Garantias a vencer"
              description="Itens com vencimento nos próximos 30 dias."
              tone="strong"
              density="editorial"
              actions={<ShieldAlert className="h-4 w-4 text-text-warning" />}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {d.warranties_expiring.map((warranty) => (
                  <Link
                    key={warranty.id}
                    href={`/properties/${id}/inventory`}
                    className="flex items-center justify-between rounded-[var(--radius-lg)] bg-bg-warning px-3 py-3 transition-colors hover:bg-bg-warning-emphasis focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] active:scale-[0.98]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ShieldCheck
                        className={cn('h-4 w-4 shrink-0', warranty.days_left <= 7 ? 'text-text-danger' : 'text-text-warning')}
                      />
                      <span className="truncate text-sm font-medium text-text-primary">{warranty.name}</span>
                    </div>
                    <span className={cn('ml-3 shrink-0 text-xs font-medium', warranty.days_left <= 7 ? 'text-text-danger' : 'text-text-warning')}>
                      {warranty.days_left === 0 ? 'Vence hoje' : `${warranty.days_left}d`}
                    </span>
                  </Link>
                ))}
              </div>
            </PageSection>
          )}

          {/* Summary card + gestão técnica */}
          <PropertySummaryCard property={property} />

          <div className="hidden">
            <PropertySummaryCard property={property} className="h-full" />

            <PageSection
              title="Gestão técnica"
              description="Acesso direto a todos os módulos do imóvel."
              tone="surface"
              density="editorial"
            >
              <div className="space-y-4">
                {/* Prontuário técnico — memória técnica e documentação do imóvel */}
                <div className="rounded-[var(--radius-xl)] border border-border-subtle bg-[var(--surface-base)] p-3">
                  <div className="mb-2.5 flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                      Prontuário técnico
                    </p>
                    <span className="flex-1 border-t border-border-subtle" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {[
                      { href: `/properties/${id}/warranties`,  icon: ShieldCheck,    label: 'Garantias',  description: 'Contratos e prazos',  tone: 'success' as const },
                      { href: `/properties/${id}/renovations`, icon: FolderKanban,   label: 'Reformas',   description: 'Obras e intervenções', tone: 'accent'  as const },
                      { href: `/properties/${id}/handover`,    icon: ClipboardCheck, label: 'Handover',   description: 'Entrega técnica',      tone: 'muted'   as const },
                      { href: `/properties/${id}/documents`,   icon: FileText,       label: 'Documentos', description: 'Arquivos do imóvel',   tone: 'muted'   as const },
                      { href: `/properties/${id}/inventory`,   icon: Package,        label: 'Inventário', description: 'Itens e sistemas',     tone: 'warning' as const },
                    ].map(({ href, icon, label, description, tone }) => (
                      <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
                    ))}
                  </div>
                </div>

                {/* Operacional — execução e acompanhamento */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                    Operacional
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { href: `/properties/${id}/services`,    icon: Wrench,    label: 'OS',         description: 'Ordens de serviço',   tone: 'accent'  as const },
                      { href: `/properties/${id}/maintenance`, icon: RefreshCw, label: 'Manutenção', description: 'Plano preventivo',    tone: 'warning' as const },
                      { href: `/properties/${id}/rooms`,       icon: Home,      label: 'Cômodos',    description: 'Ambientes do imóvel', tone: 'default' as const },
                    ].map(({ href, icon, label, description, tone }) => (
                      <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
                    ))}
                  </div>
                </div>

                {/* Financeiro — custos, despesas e relatórios */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                    Financeiro
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { href: `/properties/${id}/financial`, icon: BarChart3, label: 'Financeiro', description: 'Despesas e custos',   tone: 'success' as const },
                      { href: `/properties/${id}/report`,    icon: Activity,  label: 'Relatório',  description: 'Relatório do imóvel', tone: 'accent'  as const },
                    ].map(({ href, icon, label, description, tone }) => (
                      <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
                    ))}
                  </div>
                </div>
              </div>
            </PageSection>
          </div>

          {/* Administração do imóvel — módulos de configuração e controle de acesso */}
          <div className="hidden">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                Administração do imóvel
              </p>
              <span className="flex-1 border-t border-border-subtle" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: `/properties/${id}/team`,        icon: Users,    label: 'Equipe',       description: 'Responsáveis e colaboradores', tone: 'muted' as const },
                { href: `/properties/${id}/access`,      icon: KeyRound, label: 'Acessos',      description: 'Permissões e convites',        tone: 'muted' as const },
                { href: `/properties/${id}/credentials`, icon: Lock,     label: 'Credenciais',  description: 'Acessos técnicos seguros',     tone: 'muted' as const },
                { href: `/properties/${id}/map`,         icon: Compass,  label: 'Mapa técnico', description: 'Pontos e sistemas do imóvel',  tone: 'muted' as const },
              ].map(({ href, icon, label, description, tone }) => (
                <ActionTile key={href} href={href} icon={icon} label={label} description={description} tone={tone} density="compact" aria-label={`Abrir ${label}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <PropertyRoomsPanel propertyId={id} rooms={roomsPreviewData?.rooms ?? []} isLoading={roomsPreviewLoading} />
      )}

      {activeTab === 'tickets' && (
        <PropertyTicketsPanel propertyId={id} requests={requestsPreview} isLoading={requestsPreviewLoading} />
      )}

      {activeTab === 'services' && (
        <PropertyServicesPanel propertyId={id} orders={serviceOrdersPreview} isLoading={serviceOrdersPreviewLoading} />
      )}

      {activeTab === 'photos' && (
        <PropertyPhotosPanel propertyId={id} orders={serviceOrdersPreview} isLoading={serviceOrdersPreviewLoading} />
      )}

      {activeTab === 'documents' && (
        <PropertyDocumentsPanel
          propertyId={id}
          documents={documentsPreview}
          documentsLoading={documentsPreviewLoading}
          documentsError={Boolean(documentsPreviewError)}
          ingestionStatus={ingestionStatus}
        />
      )}

      {activeTab === 'warranties' && (
        <PropertyWarrantiesPanel
          propertyId={id}
          warranties={warrantiesPreviewData?.warranties ?? []}
          expiring={expiringWarranties}
          isLoading={warrantiesPreviewLoading}
        />
      )}

      {activeTab === 'inventory' && (
        <PropertyInventoryPanel
          propertyId={id}
          items={inventoryPreviewData?.data ?? []}
          isLoading={inventoryPreviewLoading}
        />
      )}

      {activeTab === 'handover' && <PropertyHandoverPanel propertyId={id} />}

      {/* ── TAB: HISTÓRICO ───────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="mx-auto max-w-2xl space-y-8 pb-8">
          <PropertyTimelinePanel propertyId={id} compact />

          <div className="space-y-4">
            <p className="text-sm text-text-tertiary">
              Últimas OS concluídas · <Link href={`/properties/${id}/timeline`} className="text-text-accent hover:underline">Ver linha do tempo completa</Link>
            </p>
            <TimelinePreview propertyId={id} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-secondary">Saúde por sistema</p>
              <span className="flex-1 border-t border-border-subtle" aria-hidden="true" />
            </div>
            <p className="text-xs text-text-tertiary">Estado técnico derivado das OS registradas.</p>
            <SystemsTab propertyId={id} />
          </div>
        </div>
      )}
      </main>

      <ServiceOrderCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        propertyId={id}
        onCreated={(orderId) => router.push(`/properties/${id}/services/${orderId}`)}
      />
    </div>
  );
}

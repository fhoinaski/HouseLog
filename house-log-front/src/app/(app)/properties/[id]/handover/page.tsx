'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  CheckSquare2,
  CircleAlert,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Package,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  documentsApi,
  handoverChecklistApi,
  handoverPackagesApi,
  inventoryApi,
  maintenanceApi,
  propertiesApi,
  roomsApi,
  technicalSystemsApi,
  warrantiesApi,
  type Document,
  type HandoverChecklistItem,
  type HandoverPackage,
  type InventoryItem,
  type MaintenanceSchedule,
  type Property,
  type Room,
  type TechnicalSystem,
  type Warranty,
} from '@/lib/api';
import {
  cn,
  formatDate,
  INVENTORY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
  ROOM_TYPE_LABELS,
  SYSTEM_TYPE_LABELS,
} from '@/lib/utils';
import type { HandoverPackageSnapshot } from '@houselog/contracts';

const HANDOVER_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  ready_to_issue: 'Pronto para emissão',
  issued: 'Emitido',
  accepted: 'Aceito',
  revoked: 'Revogado',
  expired: 'Expirado',
};

const HANDOVER_TYPE_LABELS: Record<string, string> = {
  handover: 'Entrega técnica',
  move_in: 'Entrada',
  move_out: 'Saída',
  inspection: 'Vistoria',
};

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  done: 'Concluído',
  issue: 'Pendência',
  not_applicable: 'Não aplicável',
};

const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  keys: 'Chaves',
  documents: 'Documentos',
  utilities: 'Utilidades',
  inventory: 'Inventário',
  cleaning: 'Limpeza',
  maintenance: 'Manutenção',
  safety: 'Segurança',
  general: 'Geral',
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatArea(value: number | null | undefined): string {
  if (value == null) return 'Não informado';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} m²`;
}

function formatQuantity(value: number | null | undefined, unit: string | null | undefined): string {
  if (value == null) return 'Não informado';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} ${unit ?? 'un'}`.trim();
}

function cardDate(value: string | null | undefined): string {
  return formatDate(value);
}

function buildSnapshotPreview(input: {
  property: Property;
  package: HandoverPackage;
  rooms: Room[];
  documents: Document[];
  technicalSystems: TechnicalSystem[];
  inventoryItems: InventoryItem[];
  warranties: Warranty[];
  maintenanceSchedules: MaintenanceSchedule[];
  checklistItems: HandoverChecklistItem[];
}): HandoverPackageSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    property: {
      id: input.property.id,
      name: input.property.name,
      type: input.property.type,
      address: input.property.address,
      city: input.property.city,
      areaM2: input.property.area_m2,
      yearBuilt: input.property.year_built,
      structure: input.property.structure,
      floors: input.property.floors,
      healthScore: input.property.health_score,
    },
    package: {
      id: input.package.id,
      title: input.package.title,
      type: input.package.type,
      version: input.package.version,
      status: input.package.status,
    },
    rooms: input.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      floor: room.floor,
      areaM2: room.area_m2,
    })),
    documents: input.documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      issueDate: document.issue_date,
      expiryDate: document.expiry_date,
    })),
    technicalSystems: input.technicalSystems.map((system) => ({
      id: system.id,
      name: system.name,
      type: system.type,
      status: system.status,
      locationSummary: system.location_summary,
      lastInspectionAt: system.last_inspection_at,
    })),
    inventoryItems: input.inventoryItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      roomId: item.room_id,
      quantity: item.quantity,
      unit: item.unit,
      warrantyUntil: item.warranty_until,
    })),
    warranties: input.warranties.map((warranty) => ({
      id: warranty.id,
      title: warranty.title,
      warrantyType: warranty.warranty_type,
      status: warranty.status,
      startDate: warranty.start_date,
      endDate: warranty.end_date,
      providerName: warranty.provider_name,
    })),
    maintenanceSchedules: input.maintenanceSchedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      systemType: schedule.system_type,
      responsible: schedule.responsible,
      frequency: schedule.frequency,
      lastDone: schedule.last_done,
      nextDue: schedule.next_due,
      autoCreateOs: Boolean(schedule.auto_create_os),
    })),
    checklistItems: input.checklistItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      required: item.required,
      condition: item.condition,
      completedAt: item.completed_at,
      roomId: item.room_id,
      documentId: item.document_id,
      inventoryItemId: item.inventory_item_id,
      serviceOrderId: item.service_order_id,
    })),
  };
}

function LoadingScreen() {
  return (
    <div className="safe-top safe-bottom min-h-screen bg-bg-page px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="hl-skeleton h-28 rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="hl-skeleton h-52 rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="hl-skeleton h-72 rounded-xl" />
            <div className="hl-skeleton h-44 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page p-6 text-center">
      <div className="max-w-md space-y-4 rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bg-danger">
          <XCircle className="h-7 w-7 text-text-danger" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-medium text-text-primary">{title}</h1>
          <p className="text-sm leading-6 text-text-secondary">{description}</p>
        </div>
        <Button onClick={onRetry} variant="outline">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function SectionListCard({
  title,
  icon: Icon,
  count,
  helper,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  helper?: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="section" density="compact" className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-accent-subtle text-text-accent">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              {helper && <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p>}
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {count === 0 ? (
          <p className="text-sm text-text-tertiary">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-bg-subtle px-3 py-2.5">
      <span className="text-xs font-medium text-text-tertiary">{label}</span>
      <span className="text-right text-sm text-text-primary">{value}</span>
    </div>
  );
}

function PackageTile({
  pkg,
  active,
  onSelect,
}: {
  pkg: HandoverPackage;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-(--surface-shadow-raised) focus-visible:outline-none focus-visible:shadow-(--field-focus-ring)',
        active ? 'border-border-focus bg-bg-accent-subtle' : 'border-border-subtle bg-bg-surface'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={pkg.status} label={HANDOVER_STATUS_LABELS[pkg.status] ?? pkg.status} />
            <span className="text-xs font-medium text-text-tertiary">{HANDOVER_TYPE_LABELS[pkg.type] ?? pkg.type}</span>
          </div>
          <p className="mt-3 truncate text-sm font-medium text-text-primary">{pkg.title}</p>
          {pkg.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{pkg.description}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-text-tertiary">v{pkg.version}</p>
          <p className="mt-1 text-[11px] text-text-secondary">{pkg.issued_at ? 'Emitido' : 'Ainda em preparo'}</p>
        </div>
      </div>
    </button>
  );
}

export default function HandoverDigitalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = use(params);

  const { data: propertyData, error: propertyError, isLoading: propertyLoading, mutate: mutateProperty } = useSWR(
    ['property', propertyId],
    () => propertiesApi.get(propertyId)
  );
  const { data: packagesData, error: packagesError, isLoading: packagesLoading, mutate: mutatePackages } = useSWR(
    ['handover-packages', propertyId],
    () => handoverPackagesApi.list(propertyId)
  );
  const { data: roomsData, error: roomsError, isLoading: roomsLoading } = useSWR(
    ['handover-rooms', propertyId],
    () => roomsApi.list(propertyId)
  );
  const { data: documentsData, error: documentsError, isLoading: documentsLoading } = useSWR(
    ['handover-documents', propertyId],
    () => documentsApi.list(propertyId)
  );
  const { data: systemsData, error: systemsError, isLoading: systemsLoading } = useSWR(
    ['handover-systems', propertyId],
    () => technicalSystemsApi.list(propertyId)
  );
  const { data: warrantiesData, error: warrantiesError, isLoading: warrantiesLoading } = useSWR(
    ['handover-warranties', propertyId],
    () => warrantiesApi.list(propertyId)
  );
  const { data: inventoryData, error: inventoryError, isLoading: inventoryLoading } = useSWR(
    ['handover-inventory', propertyId],
    () => inventoryApi.list(propertyId)
  );
  const { data: maintenanceData, error: maintenanceError, isLoading: maintenanceLoading } = useSWR(
    ['handover-maintenance', propertyId],
    () => maintenanceApi.list(propertyId)
  );

  const property = propertyData?.property ?? null;
  const packages = useMemo(() => [...(packagesData?.packages ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ), [packagesData]);

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  useEffect(() => {
    if (packages.length === 0) {
      setSelectedPackageId(null);
      return;
    }

    if (!selectedPackageId || !packages.some((pkg) => pkg.id === selectedPackageId)) {
      setSelectedPackageId(packages[0]?.id ?? null);
    }
  }, [packages, selectedPackageId]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? packages[0] ?? null,
    [packages, selectedPackageId]
  );

  const rooms = useMemo(() => roomsData?.rooms ?? [], [roomsData]);
  const documents = useMemo(() => documentsData?.data ?? [], [documentsData]);
  const technicalSystems = useMemo(() => systemsData?.systems ?? [], [systemsData]);
  const warranties = useMemo(() => warrantiesData?.warranties ?? [], [warrantiesData]);
  const inventoryItems = useMemo(() => inventoryData?.data ?? [], [inventoryData]);
  const maintenanceSchedules = useMemo(() => maintenanceData?.schedules ?? [], [maintenanceData]);
  const checklistQuery = useSWR(
    selectedPackage ? ['handover-checklist', propertyId, selectedPackage.id] : null,
    () => handoverChecklistApi.list(propertyId, selectedPackage!.id)
  );
  const checklistError = checklistQuery.error instanceof Error ? checklistQuery.error : null;
  const auxiliaryErrors = [roomsError, documentsError, systemsError, warrantiesError, inventoryError, maintenanceError].filter(
    (value): value is Error => value instanceof Error
  );
  const auxiliaryLoading = roomsLoading || documentsLoading || systemsLoading || warrantiesLoading || inventoryLoading || maintenanceLoading;
  const roomNameById = useMemo(() => new Map(rooms.map((room) => [room.id, room.name])), [rooms]);
  const checklistItems = useMemo(() => checklistQuery.data?.items ?? [], [checklistQuery.data]);

  const previewSnapshot = useMemo(() => {
    if (!selectedPackage || !property) return null;
    if (selectedPackage.snapshot_json) return selectedPackage.snapshot_json;

    return buildSnapshotPreview({
      property,
      package: selectedPackage,
      rooms,
      documents,
      technicalSystems,
      inventoryItems,
      warranties,
      maintenanceSchedules,
      checklistItems,
    });
  }, [
    checklistItems,
    documents,
    inventoryItems,
    maintenanceSchedules,
    property,
    rooms,
    selectedPackage,
    technicalSystems,
    warranties,
  ]);

  const checklistDone = checklistItems.filter((item) => item.status === 'done').length;
  const checklistPending = checklistItems.filter((item) => item.status !== 'done').length;
  const packageIsReady = selectedPackage?.status === 'ready_to_issue';

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [issuedPackageId, setIssuedPackageId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (issuedPackageId && selectedPackage?.id !== issuedPackageId) {
      setIssuedLink(null);
      setIssuedPackageId(null);
      setIssueError(null);
    }
  }, [issuedPackageId, selectedPackage?.id]);

  const anyCriticalError = propertyError || packagesError;

  async function handleIssue() {
    if (!selectedPackage) return;

    setIssuing(true);
    setIssueError(null);
    try {
      const result = await handoverPackagesApi.issue(propertyId, selectedPackage.id);
      setIssuedLink(result.publicAccessUrl);
      setIssuedPackageId(result.package.id);
      setIssueDialogOpen(false);
      toast.success('Chave digital emitida.');
      await mutatePackages();
      await mutateProperty();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível emitir a chave digital.';
      setIssueError(message);
      toast.error('Falha ao emitir chave digital', { description: message });
    } finally {
      setIssuing(false);
    }
  }

  async function copyIssuedLink() {
    if (!issuedLink) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(issuedLink);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    } finally {
      setCopying(false);
    }
  }

  const isLoading = propertyLoading || packagesLoading;

  if (isLoading) return <LoadingScreen />;

  if (anyCriticalError) {
    return (
      <ErrorScreen
        title="Não foi possível carregar a entrega digital"
        description={
          propertyError instanceof Error
            ? propertyError.message
            : packagesError instanceof Error
              ? packagesError.message
              : 'Tente novamente em alguns instantes.'
        }
        onRetry={() => {
          void mutateProperty();
          void mutatePackages();
        }}
      />
    );
  }

  if (!property || !selectedPackage) {
    return (
      <div className="safe-top safe-bottom min-h-screen bg-bg-page px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <PageHeader
            eyebrow="Handover Digital"
            title="Entrega digital da construtora"
            description="Pacotes de entrega técnica, snapshot e emissão da chave pública do imóvel."
            actions={
              <Button variant="outline" asChild>
                <Link href={`/properties/${propertyId}`}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Voltar ao imóvel
                </Link>
              </Button>
            }
          />
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
            title="Nenhum pacote de handover disponível"
            description="Crie um pacote de entrega no imóvel antes de emitir a chave digital."
            actions={
              <Button variant="outline" asChild>
                <Link href={`/properties/${propertyId}`}>Voltar ao imóvel</Link>
              </Button>
            }
            tone="subtle"
            density="spacious"
          />
        </div>
      </div>
    );
  }

  const pendingChecklist = checklistItems.filter((item) => item.status !== 'done');
  const latestSnapshot = previewSnapshot;
  const canPrepareIssue = packageIsReady && !checklistQuery.isLoading && latestSnapshot !== null;

  return (
    <div className="safe-top safe-bottom min-h-screen bg-bg-page px-4 py-5 sm:px-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PageHeader
          eyebrow="Handover Digital"
          title="Entrega digital da construtora"
          description={`Pacote técnico do imóvel ${property.name}. Revise o snapshot, valide pendências e emita a chave pública somente quando estiver pronto.`}
          actions={
            <Button variant="outline" asChild>
              <Link href={`/properties/${propertyId}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar ao imóvel
              </Link>
            </Button>
          }
        />

        {issuedLink && issuedPackageId === selectedPackage.id && (
          <Card className="border-border-success bg-bg-success/20">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Chave digital emitida
                </div>
                <p className="text-sm leading-6 text-text-secondary">
                  O link público foi gerado para o pacote selecionado. Compartilhe com cuidado e revogue se houver qualquer exposição indevida.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void copyIssuedLink()} loading={copying}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copiar link
                </Button>
                <Button variant="premium" asChild>
                  <a href={issuedLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Abrir link
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <PageSection title="Pacotes do imóvel" description="Escolha a versão que será revisada ou emitida." tone="surface" density="compact">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg) => (
              <PackageTile
                key={pkg.id}
                pkg={pkg}
                active={selectedPackage.id === pkg.id}
                onSelect={() => setSelectedPackageId(pkg.id)}
              />
            ))}
          </div>
        </PageSection>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="space-y-5">
            <PageSection title="Dados do imóvel" description="Base operacional que será fixada no pacote emitido." tone="surface" density="compact">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <Card variant="raised" density="compact" className="border-border-subtle">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-bg-accent-subtle px-3 py-1 text-xs font-medium text-text-accent">
                          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
                        </div>
                        <CardTitle className="text-lg">{property.name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <MapPin className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                          <span>{property.address}, {property.city}</span>
                        </div>
                      </div>
                      <StatusBadge status="accepted" label={`Saúde ${property.health_score}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoRow label="Área" value={formatArea(property.area_m2)} />
                      <InfoRow label="Pavimentos" value={property.floors ?? 'Não informado'} />
                      <InfoRow label="Ano de construção" value={property.year_built ?? 'Não informado'} />
                      <InfoRow label="Estrutura" value={property.structure ?? 'Não informada'} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <MetricCard label="Ambientes" value={rooms.length} icon={Building2} />
                      <MetricCard label="Documentos" value={documents.length} icon={FileText} />
                      <MetricCard label="Sistemas" value={technicalSystems.length} icon={Wrench} />
                      <MetricCard label="Inventário" value={inventoryItems.length} icon={Package} />
                    </div>

                    {rooms.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Ambientes incluídos</p>
                        <div className="flex flex-wrap gap-2">
                          {rooms.map((room) => (
                            <Badge key={room.id} variant="outline">
                              {room.name} · {ROOM_TYPE_LABELS[room.type] ?? room.type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {auxiliaryLoading && (
                      <div className="rounded-lg bg-bg-subtle px-3 py-2 text-xs text-text-secondary">
                        Carregando módulos de apoio do snapshot.
                      </div>
                    )}

                    {auxiliaryErrors.length > 0 && (
                      <div className="rounded-lg bg-bg-warning px-3 py-2 text-xs text-text-warning">
                        Alguns módulos de apoio não puderam ser carregados. A prévia segue com os dados disponíveis.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card variant="raised" density="compact" className="border-border-subtle">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Pacote selecionado</CardTitle>
                    <p className="text-sm leading-6 text-text-secondary">Versão corrente da entrega digital e seus marcos operacionais.</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <InfoRow label="Título" value={selectedPackage.title} />
                    <InfoRow label="Status" value={<StatusBadge status={selectedPackage.status} label={HANDOVER_STATUS_LABELS[selectedPackage.status] ?? selectedPackage.status} />} />
                    <InfoRow label="Versão" value={`v${selectedPackage.version}`} />
                    <InfoRow label="Criado em" value={cardDate(selectedPackage.created_at)} />
                    <InfoRow label="Emitido em" value={cardDate(selectedPackage.issued_at)} />
                    <InfoRow label="Expira em" value={cardDate(selectedPackage.expires_at)} />
                    {selectedPackage.status === 'accepted' && (
                      <>
                        <InfoRow label="Aceito em" value={formatDateTime(selectedPackage.accepted_at)} />
                        <InfoRow label="Aceito por" value={selectedPackage.accepted_by_name ?? 'Nao informado'} />
                      </>
                    )}

                    <div className="mt-4 rounded-lg bg-bg-subtle p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Pronto para leitura da construtora
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">
                        A emissão sela uma cópia do snapshot e publica apenas o link controlado pelo token do pacote.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </PageSection>

            <PageSection title="Checklist do pacote" description="Pendências operacionais antes da emissão." tone="surface" density="compact">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Itens revisados" value={checklistDone} icon={CheckSquare2} tone="success" />
                  <MetricCard label="Pendências" value={checklistPending} icon={CircleAlert} tone={checklistPending > 0 ? 'warning' : 'default'} />
                  <MetricCard label="Total" value={checklistItems.length} icon={ClipboardCheck} tone="accent" />
                </div>

                {checklistQuery.isLoading ? (
                  <div className="space-y-2">
                    <div className="hl-skeleton h-24 rounded-xl" />
                    <div className="hl-skeleton h-24 rounded-xl" />
                  </div>
                ) : checklistError ? (
                  <div className="rounded-xl bg-bg-warning p-4 text-sm text-text-warning">
                    Não foi possível carregar o checklist do pacote agora.
                  </div>
                ) : checklistItems.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
                    title="Checklist ainda não preenchido"
                    description="Os itens de conferência do pacote aparecerão aqui assim que houver registros vinculados à entrega."
                    tone="subtle"
                    density="compact"
                  />
                ) : (
                  <div className="grid gap-2">
                    {checklistItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge
                                status={item.status}
                                label={CHECKLIST_STATUS_LABELS[item.status] ?? item.status}
                              />
                              <Badge variant="outline">{CHECKLIST_CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                              {item.required && <Badge variant="destructive">Obrigatório</Badge>}
                            </div>
                            <p className="mt-2 text-sm font-medium text-text-primary">{item.title}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-text-tertiary">
                            {item.completed_at ? `Concluído em ${cardDate(item.completed_at)}` : 'Aguardando conclusão'}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
                          <span>Ambiente: {item.room_id ? (roomNameById.get(item.room_id) ?? item.room_id) : 'Não vinculado'}</span>
                          <span>Documento: {item.document_id ?? 'Não vinculado'}</span>
                          <span>Inventário: {item.inventory_item_id ?? 'Não vinculado'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pendingChecklist.length > 0 && (
                  <div className="rounded-lg border border-border-warning bg-bg-warning p-3 text-sm text-text-warning">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      {pendingChecklist.length} item(ns) ainda exigem revisão
                    </div>
                    <p className="mt-1 leading-6">
                      Mostramos a pendência antes da emissão para preservar a governança do pacote.
                    </p>
                  </div>
                )}
              </div>
            </PageSection>

            <PageSection title="Prévia do snapshot" description="Versão congelada que será gravada no pacote emitido." tone="surface" density="compact">
              {latestSnapshot ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <SectionListCard
                    title="Documentos incluídos"
                    icon={FileText}
                    count={latestSnapshot.documents.length}
                    helper={`Gerado em ${formatDateTime(latestSnapshot.generatedAt)}`}
                    emptyText="Nenhum documento entrou neste pacote ainda."
                  >
                    <div className="space-y-2">
                      {latestSnapshot.documents.slice(0, 3).map((document) => (
                        <div key={document.id} className="rounded-lg bg-bg-subtle px-3 py-2.5">
                          <p className="text-sm font-medium text-text-primary">{document.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {document.type} · Emitido {cardDate(document.issueDate)} · Válido até {cardDate(document.expiryDate)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionListCard>

                  <SectionListCard
                    title="Sistemas técnicos"
                    icon={Wrench}
                    count={latestSnapshot.technicalSystems.length}
                    helper="Equipamentos e sistemas que sustentam a operação inicial."
                    emptyText="Nenhum sistema técnico foi vinculado ainda."
                  >
                    <div className="space-y-2">
                      {latestSnapshot.technicalSystems.slice(0, 3).map((system) => (
                        <div key={system.id} className="rounded-lg bg-bg-subtle px-3 py-2.5">
                          <p className="text-sm font-medium text-text-primary">{system.name}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {SYSTEM_TYPE_LABELS[system.type] ?? system.type} · {system.locationSummary ?? 'Sem local definido'} · Última inspeção {cardDate(system.lastInspectionAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionListCard>

                  <SectionListCard
                    title="Garantias"
                    icon={ShieldCheck}
                    count={latestSnapshot.warranties.length}
                    helper="Coberturas fixadas no momento da emissão."
                    emptyText="Nenhuma garantia vinculada ao pacote."
                  >
                    <div className="space-y-2">
                      {latestSnapshot.warranties.slice(0, 3).map((warranty) => (
                        <div key={warranty.id} className="rounded-lg bg-bg-subtle px-3 py-2.5">
                          <p className="text-sm font-medium text-text-primary">{warranty.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {warranty.warrantyType} · Válida até {cardDate(warranty.endDate)}
                            {warranty.providerName ? ` · ${warranty.providerName}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionListCard>

                  <SectionListCard
                    title="Inventário técnico"
                    icon={Package}
                    count={latestSnapshot.inventoryItems.length}
                    helper="Itens físicos que acompanham a entrega."
                    emptyText="Nenhum item de inventário foi vinculado ainda."
                  >
                    <div className="space-y-2">
                      {latestSnapshot.inventoryItems.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-lg bg-bg-subtle px-3 py-2.5">
                          <p className="text-sm font-medium text-text-primary">{item.name}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {INVENTORY_CATEGORY_LABELS[item.category] ?? item.category} · {formatQuantity(item.quantity, item.unit)}
                            {item.roomId ? ` · Ambiente ${roomNameById.get(item.roomId) ?? item.roomId}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionListCard>

                  <SectionListCard
                    title="Manutenções recomendadas"
                    icon={CalendarClock}
                    count={latestSnapshot.maintenanceSchedules.length}
                    helper="Rotina preventiva que acompanha a entrega inicial."
                    emptyText="Nenhuma manutenção recomendada vinculada ao pacote."
                  >
                    <div className="space-y-2">
                      {latestSnapshot.maintenanceSchedules.slice(0, 3).map((schedule) => (
                        <div key={schedule.id} className="rounded-lg bg-bg-subtle px-3 py-2.5">
                          <p className="text-sm font-medium text-text-primary">{schedule.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {schedule.systemType} · Responsável {schedule.responsible ?? 'Não informado'} · Próxima {cardDate(schedule.nextDue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionListCard>
                </div>
              ) : (
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm text-text-secondary">
                  Não foi possível montar a prévia do snapshot para este pacote.
                </div>
              )}
            </PageSection>
          </div>

          <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <PageSection title="Status do pacote" description="Controle operacional da emissão digital." tone="strong" density="compact">
              <div className="space-y-4">
                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Situação atual</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={selectedPackage.status}
                          label={HANDOVER_STATUS_LABELS[selectedPackage.status] ?? selectedPackage.status}
                        />
                        <Badge variant="outline">v{selectedPackage.version}</Badge>
                      </div>
                    </div>
                    <div className="rounded-full bg-bg-accent-subtle p-2 text-text-accent">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <InfoRow label="Checklist" value={`${checklistDone}/${checklistItems.length}`} />
                    <InfoRow label="Pendências" value={pendingChecklist.length} />
                    <InfoRow label="Snapshot" value={latestSnapshot ? 'Disponível' : 'Em montagem'} />
                    <InfoRow label="Emitido em" value={cardDate(selectedPackage.issued_at)} />
                    <InfoRow label="Expira em" value={cardDate(selectedPackage.expires_at)} />
                    {selectedPackage.status === 'accepted' && (
                      <>
                        <InfoRow label="Aceito em" value={formatDateTime(selectedPackage.accepted_at)} />
                        <InfoRow label="Aceito por" value={selectedPackage.accepted_by_name ?? 'Nao informado'} />
                      </>
                    )}
                  </div>

                  {selectedPackage.status === 'accepted' ? (
                    <div className="mt-4 rounded-lg bg-bg-success p-3 text-sm text-text-success">
                      Pacote aceito pelo proprietario. O comprovante publico permanece consultavel enquanto o link estiver valido e nao revogado.
                    </div>
                  ) : packageIsReady ? (
                    <div className="mt-4 rounded-lg bg-bg-success p-3 text-sm text-text-success">
                      {canPrepareIssue
                        ? 'O pacote está pronto para emissão. Revise as pendências acima antes de confirmar.'
                        : 'O pacote está pronto, mas a prévia e o checklist ainda estão carregando para revisão.'}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg bg-bg-warning p-3 text-sm text-text-warning">
                      Este pacote ainda não está pronto para emissão. Ajuste o status no fluxo interno antes de continuar.
                    </div>
                  )}
                </div>

                <Button
                  variant="premium"
                  className="w-full"
                  disabled={!canPrepareIssue || issuing}
                  onClick={() => setIssueDialogOpen(true)}
                >
                  {issuing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                  Emitir chave digital
                </Button>

                <p className="text-xs leading-6 text-text-tertiary">
                  A emissão gera uma cópia congelada do pacote e um link público controlado por token. Não compartilhe fora do fluxo autorizado.
                </p>

                <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <ShieldAlert className="h-4 w-4 text-text-warning" aria-hidden="true" />
                    Aviso de segurança
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    O link público deve circular apenas entre pessoas autorizadas. Se houver exposição indevida, revogue o pacote e gere uma nova chave.
                  </p>
                </div>

                {issueError && (
                  <div className="rounded-xl border border-border-danger bg-bg-danger p-4 text-sm text-text-danger">
                    {issueError}
                  </div>
                )}
              </div>
            </PageSection>

            <PageSection title="Risco de emissão" description="O que precisa estar claro antes de publicar." tone="surface" density="compact">
              <div className="space-y-2 text-sm leading-6 text-text-secondary">
                <div className="flex gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-text-warning" aria-hidden="true" />
                  <p>Itens ainda pendentes aparecem antes da emissão para que a construtora valide a entrega com governança.</p>
                </div>
                <div className="flex gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-text-warning" aria-hidden="true" />
                  <p>O snapshot visualizado aqui usa os dados correntes do imóvel ou a versão já fixada, sem revelar token hash ou chave de armazenamento.</p>
                </div>
                <div className="flex gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-text-warning" aria-hidden="true" />
                  <p>Se o pacote já foi emitido, a tela passa a exibir a URL pública desta sessão para cópia ou abertura em nova aba.</p>
                </div>
              </div>
            </PageSection>
          </div>
        </div>
      </div>

      <Dialog open={issueDialogOpen} onOpenChange={(open) => { if (!issuing) setIssueDialogOpen(open); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirmar emissão da chave digital</DialogTitle>
            <DialogDescription>
              O pacote {selectedPackage.title} será congelado e publicado com um link público controlado. Esta ação deve ser feita somente após a revisão final da construtora.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-bg-subtle p-3 text-sm leading-6 text-text-secondary">
              A emissão sela a versão atual do snapshot, preserva a rastreabilidade e disponibiliza o link público para consulta controlada.
            </div>

            <div className="grid gap-2">
              <InfoRow label="Pacote" value={selectedPackage.title} />
              <InfoRow label="Pendências" value={pendingChecklist.length} />
              <InfoRow label="Validade padrão" value={formatDate(new Date(Date.now() + 30 * 86_400_000).toISOString())} />
            </div>

            {issueError && <p className="text-sm text-text-danger">{issueError}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setIssueDialogOpen(false)} disabled={issuing}>
                Cancelar
              </Button>
              <Button variant="premium" loading={issuing} onClick={() => void handleIssue()}>
                Emitir chave digital
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

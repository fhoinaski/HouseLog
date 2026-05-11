'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Home,
  Package,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { HandoverPackagePublic, HandoverPackageSnapshot } from '@houselog/contracts';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicHandoverAcceptance } from '@/components/handover/public-handover-acceptance';
import { formatDate, INVENTORY_CATEGORY_LABELS, SYSTEM_TYPE_LABELS } from '@/lib/utils';

type PublicHandoverPackageViewProps = {
  token: string;
  handoverPackage: HandoverPackagePublic;
};

type SnapshotListCardProps = {
  title: string;
  description: string;
  count: number;
  icon: ComponentType<{ className?: string }>;
  emptyText: string;
  children: ReactNode;
};

type DetailItemProps = {
  title: string;
  detail?: ReactNode;
  meta?: ReactNode;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nao informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatQuantity(value: number | null | undefined, unit: string | null | undefined): string {
  if (value == null) return 'Quantidade nao informada';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} ${unit ?? 'un'}`.trim();
}

function formatOptional(value: string | null | undefined): string {
  return value?.trim() ? value : 'Nao informado';
}

function formatSystemType(value: string): string {
  return SYSTEM_TYPE_LABELS[value] ?? value;
}

function formatInventoryCategory(value: string): string {
  return INVENTORY_CATEGORY_LABELS[value] ?? value;
}

function SnapshotListCard({
  title,
  description,
  count,
  icon: Icon,
  emptyText,
  children,
}: SnapshotListCardProps) {
  return (
    <Card variant="section" density="comfortable" className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base leading-6">{title}</CardTitle>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0" aria-label={`${count} itens`}>
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3 text-sm leading-6 text-text-secondary">
            {emptyText}
          </p>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailItem({ title, detail, meta }: DetailItemProps) {
  return (
    <article className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
      {meta && <p className="mb-1 text-xs font-medium text-text-tertiary">{meta}</p>}
      <h3 className="text-sm font-medium leading-5 text-text-primary">{title}</h3>
      {detail && <p className="mt-1 text-xs leading-5 text-text-secondary">{detail}</p>}
    </article>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
        <Icon className="h-4 w-4 text-text-accent" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none text-text-primary">{value}</p>
    </div>
  );
}

function StatusPanel({
  snapshot,
  handoverPackage,
}: {
  snapshot: HandoverPackageSnapshot;
  handoverPackage: HandoverPackagePublic;
}) {
  return (
    <Card variant="raised" density="comfortable">
      <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] bg-bg-success px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {handoverPackage.status === 'accepted' ? 'Entrega aceita' : 'Pacote emitido'}
          </div>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {handoverPackage.status === 'accepted'
              ? 'O recebimento digital deste pacote foi confirmado.'
              : 'Esta versao esta disponivel para consulta pelo proprietario.'}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <CalendarClock className="h-4 w-4 text-text-accent" aria-hidden="true" />
            Data de emissao
          </div>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {formatDateTime(handoverPackage.issued_at ?? snapshot.generatedAt)}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Clock3 className="h-4 w-4 text-text-warning" aria-hidden="true" />
            Validade do pacote
          </div>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{formatDate(handoverPackage.expires_at)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PublicHandoverPackageView({ token, handoverPackage }: PublicHandoverPackageViewProps) {
  const [currentPackage, setCurrentPackage] = useState(handoverPackage);
  const accepted = currentPackage.status === 'accepted';
  const snapshot = currentPackage.snapshot_json;
  const property = snapshot.property;
  const responsibleDisplay =
    currentPackage.companyName && currentPackage.responsibleName
      ? `${currentPackage.companyName} - ${currentPackage.responsibleName}`
      : currentPackage.companyName ?? currentPackage.responsibleName ?? currentPackage.issuerName;
  const responsibleDetail = currentPackage.issuerRole ? ` (${currentPackage.issuerRole})` : '';
  const deliveryMessage =
    currentPackage.description?.trim() ||
    'Este pacote reune as informacoes essenciais da entrega digital do imovel para consulta segura pelo proprietario.';

  return (
    <main className="safe-top safe-bottom min-h-screen bg-bg-page px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-bg-accent-subtle px-3 py-2 text-xs font-medium text-text-accent">
              <Home className="h-4 w-4" aria-hidden="true" />
              HouseLog Handover Digital
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-text-tertiary">Entrega tecnica do imovel</p>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-text-primary sm:text-5xl">
                {property.name}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">{deliveryMessage}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{accepted ? 'Entrega digital aceita' : 'Entrega digital emitida'}</Badge>
              <Badge variant="outline">{formatOptional(property.city)}</Badge>
              <Badge variant="outline">Versao {currentPackage.version}</Badge>
            </div>
          </div>

          <Card variant="raised" density="comfortable">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo para o proprietario</CardTitle>
              <p className="text-sm leading-6 text-text-secondary">
                Pacote preparado para consulta simples, sem expor dados internos do sistema.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Imovel</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">
                  {property.address}, {property.city}
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Construtora ou responsavel</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">
                  {responsibleDisplay ? `${responsibleDisplay}${responsibleDetail}` : 'Nao informado neste pacote'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SummaryMetric label="Documentos" value={snapshot.documents.length} icon={FileText} />
                <SummaryMetric label="Garantias" value={snapshot.warranties.length} icon={ShieldCheck} />
              </div>
            </CardContent>
          </Card>
        </header>

        <StatusPanel snapshot={snapshot} handoverPackage={currentPackage} />

        <PublicHandoverAcceptance
          token={token}
          handoverPackage={currentPackage}
          onAccepted={setCurrentPackage}
          formatDateTime={formatDateTime}
        />

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Conteudo do pacote de handover">
          <SnapshotListCard
            title="Documentos incluidos"
            description="Manuais, memoriais, laudos, plantas e documentos de apoio da entrega."
            count={snapshot.documents.length}
            icon={FileText}
            emptyText="Nenhum documento foi incluido neste pacote."
          >
            {snapshot.documents.map((document) => (
              <DetailItem
                key={document.id}
                title={document.title}
                meta={document.type}
                detail={`Emitido em ${formatDate(document.issueDate)}. Validade: ${formatDate(document.expiryDate)}.`}
              />
            ))}
          </SnapshotListCard>

          <SnapshotListCard
            title="Garantias"
            description="Coberturas importantes para acompanhar prazos e responsabilidades."
            count={snapshot.warranties.length}
            icon={ShieldCheck}
            emptyText="Nenhuma garantia foi incluida neste pacote."
          >
            {snapshot.warranties.map((warranty) => (
              <DetailItem
                key={warranty.id}
                title={warranty.title}
                meta={warranty.warrantyType}
                detail={`Valida ate ${formatDate(warranty.endDate)}.${warranty.providerName ? ` Responsavel: ${warranty.providerName}.` : ''}`}
              />
            ))}
          </SnapshotListCard>

          <SnapshotListCard
            title="Sistemas tecnicos"
            description="Conjuntos do imovel que merecem acompanhamento ao longo do uso."
            count={snapshot.technicalSystems.length}
            icon={Wrench}
            emptyText="Nenhum sistema tecnico foi incluido neste pacote."
          >
            {snapshot.technicalSystems.map((system) => (
              <DetailItem
                key={system.id}
                title={system.name}
                meta={formatSystemType(system.type)}
                detail={`Local: ${formatOptional(system.locationSummary)}. Ultima revisao: ${formatDate(system.lastInspectionAt)}.`}
              />
            ))}
          </SnapshotListCard>

          <SnapshotListCard
            title="Inventario tecnico"
            description="Itens, equipamentos e componentes relevantes entregues com a unidade."
            count={snapshot.inventoryItems.length}
            icon={Package}
            emptyText="Nenhum item de inventario foi incluido neste pacote."
          >
            {snapshot.inventoryItems.map((item) => (
              <DetailItem
                key={item.id}
                title={item.name}
                meta={formatInventoryCategory(item.category)}
                detail={`${formatQuantity(item.quantity, item.unit)}.${item.warrantyUntil ? ` Garantia ate ${formatDate(item.warrantyUntil)}.` : ''}`}
              />
            ))}
          </SnapshotListCard>

          <SnapshotListCard
            title="Manutencoes recomendadas"
            description="Cuidados sugeridos para preservar desempenho, conforto e garantias."
            count={snapshot.maintenanceSchedules.length}
            icon={CalendarClock}
            emptyText="Nenhuma manutencao recomendada foi incluida neste pacote."
          >
            {snapshot.maintenanceSchedules.map((schedule) => (
              <DetailItem
                key={schedule.id}
                title={schedule.title}
                meta={formatSystemType(schedule.systemType)}
                detail={`Frequencia: ${formatOptional(schedule.frequency)}. Proxima referencia: ${formatDate(schedule.nextDue)}.${schedule.responsible ? ` Responsavel: ${schedule.responsible}.` : ''}`}
              />
            ))}
          </SnapshotListCard>

          <Card variant="section" density="comfortable" className="h-full">
            <CardHeader className="pb-3">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-warning text-text-warning">
                  <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-base">Seguranca do pacote</CardTitle>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Este link abre somente este pacote emitido, com validade definida e escopo limitado.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailItem
                title="Aceite protegido"
                meta={<span className="inline-flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> Consulta</span>}
                detail="O aceite registra somente o recebimento deste pacote emitido, sem alterar dados tecnicos do imovel."
              />
              <DetailItem
                title="Compartilhamento controlado"
                meta={<span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> HouseLog</span>}
                detail="Se voce recebeu este link por engano, solicite uma nova emissao ao responsavel pela entrega."
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

'use client';

import { use, useMemo, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, Map as MapIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import {
  roomsApi,
  technicalPointsApi,
  technicalSystemsApi,
  type CreateTechnicalPointInput,
  type Room,
  type TechnicalPoint,
  type TechnicalPointRiskLevel,
  type TechnicalPointType,
  type TechnicalSystem,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const NONE_VALUE = 'none';

const POINT_TYPES: Array<{ value: TechnicalPointType; label: string }> = [
  { value: 'valve', label: 'Registro/valvula' },
  { value: 'pipe', label: 'Tubulacao' },
  { value: 'drain', label: 'Dreno/ralo' },
  { value: 'inspection_box', label: 'Caixa de inspeção' },
  { value: 'electrical_panel', label: 'Quadro eletrico' },
  { value: 'conduit', label: 'Conduite' },
  { value: 'outlet', label: 'Tomada' },
  { value: 'switch', label: 'Interruptor' },
  { value: 'gas_line', label: 'Linha de gas' },
  { value: 'hvac_line', label: 'Linha HVAC' },
  { value: 'network_point', label: 'Ponto de rede' },
  { value: 'sensor', label: 'Sensor' },
  { value: 'waterproofing_area', label: 'Area impermeabilizada' },
  { value: 'structural_element', label: 'Elemento estrutural' },
  { value: 'other', label: 'Outro' },
];

const RISK_LEVELS: Array<{ value: TechnicalPointRiskLevel; label: string }> = [
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Alto' },
];

const RISK_STYLES: Record<TechnicalPointRiskLevel, string> = {
  low: 'bg-bg-success text-text-success',
  medium: 'bg-bg-warning text-text-warning',
  high: 'bg-bg-danger text-text-danger',
};

type PointFormState = {
  name: string;
  type: TechnicalPointType;
  technical_system_id: string;
  room_id: string;
  description: string;
  floor: string;
  risk_level: TechnicalPointRiskLevel;
  position_x: string;
  position_y: string;
  reference_image_url: string;
};

const DEFAULT_FORM: PointFormState = {
  name: '',
  type: 'valve',
  technical_system_id: '',
  room_id: '',
  description: '',
  floor: '0',
  risk_level: 'low',
  position_x: '',
  position_y: '',
  reference_image_url: '',
};

function typeLabel(type: TechnicalPointType): string {
  return POINT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function riskLabel(risk: TechnicalPointRiskLevel): string {
  return RISK_LEVELS.find((item) => item.value === risk)?.label ?? risk;
}

function toForm(point: TechnicalPoint): PointFormState {
  return {
    name: point.name,
    type: point.type,
    technical_system_id: point.technical_system_id ?? '',
    room_id: point.room_id ?? '',
    description: point.description ?? '',
    floor: String(point.floor),
    risk_level: point.risk_level,
    position_x: point.position_x == null ? '' : String(point.position_x),
    position_y: point.position_y == null ? '' : String(point.position_y),
    reference_image_url: point.reference_image_url ?? '',
  };
}

function optionalCoordinate(value: string): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toPayload(form: PointFormState): CreateTechnicalPointInput {
  return {
    name: form.name.trim(),
    type: form.type,
    technical_system_id: form.technical_system_id || null,
    room_id: form.room_id || null,
    description: form.description.trim() || null,
    floor: Number.parseInt(form.floor, 10) || 0,
    risk_level: form.risk_level,
    position_x: optionalCoordinate(form.position_x),
    position_y: optionalCoordinate(form.position_y),
    reference_image_url: form.reference_image_url.trim() || null,
  };
}

export default function PropertyMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<TechnicalPoint | null>(null);
  const [form, setForm] = useState<PointFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(['technical-points', id], () =>
    technicalPointsApi.list(id)
  );
  const { data: systemsData } = useSWR(['technical-systems', id], () => technicalSystemsApi.list(id));
  const { data: roomsData } = useSWR(['rooms', id], () => roomsApi.list(id));

  const points = useMemo(() => data?.points ?? [], [data?.points]);
  const systems = useMemo(() => systemsData?.systems ?? [], [systemsData?.systems]);
  const rooms = useMemo(() => roomsData?.rooms ?? [], [roomsData?.rooms]);
  const canManage = user?.role !== 'provider' && user?.role !== 'temp_provider';

  const systemById = useMemo(() => {
    return new Map<string, TechnicalSystem>(systems.map((system) => [system.id, system]));
  }, [systems]);

  const roomById = useMemo(() => {
    return new Map<string, Room>(rooms.map((room) => [room.id, room]));
  }, [rooms]);

  const highRiskCount = points.filter((point) => point.risk_level === 'high').length;
  const positionedCount = points.filter((point) => point.position_x != null && point.position_y != null).length;

  function openCreate() {
    setEditingPoint(null);
    setForm(DEFAULT_FORM);
    setFormOpen(true);
  }

  function openEdit(point: TechnicalPoint) {
    setEditingPoint(point);
    setForm(toForm(point));
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);

    if (!payload.name) {
      toast.error('Informe o nome do ponto técnico.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingPoint) {
        await technicalPointsApi.update(id, editingPoint.id, payload);
        toast.success('Ponto técnico atualizado.');
      } else {
        await technicalPointsApi.create(id, payload);
        toast.success('Ponto técnico cadastrado.');
      }
      await mutate();
      setFormOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar o ponto técnico.';
      toast.error('Erro ao salvar ponto', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function removePoint(point: TechnicalPoint) {
    if (!window.confirm(`Remover "${point.name}" do mapa técnico?`)) return;
    setDeletingId(point.id);
    try {
      await technicalPointsApi.delete(id, point.id);
      await mutate();
      toast.success('Ponto técnico removido.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível remover o ponto técnico.';
      toast.error('Erro ao remover ponto', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Mapa tecnico"
        title="Mapa"
        description="Pontos tecnicos do imovel vinculados a sistemas, ambientes, risco e coordenadas relativas."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar ponto técnico
            </Button>
          ) : null
        }
      />

      <PageSection
        title="Leitura do mapa"
        description="Primeira camada estruturada para localizar infraestrutura e pontos de inspeção."
        tone="strong"
        density="compact"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-3">
            <p className="text-xs text-text-tertiary">Pontos cadastrados</p>
            <p className="mt-1 text-2xl font-light tabular-nums text-text-primary">{points.length}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-bg-danger px-3 py-3">
            <p className="text-xs text-text-tertiary">Risco alto</p>
            <p className="mt-1 text-2xl font-light tabular-nums text-text-danger">{highRiskCount}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-bg-accent-subtle px-3 py-3">
            <p className="text-xs text-text-tertiary">Com coordenadas</p>
            <p className="mt-1 text-2xl font-light tabular-nums text-text-accent">{positionedCount}</p>
          </div>
        </div>
      </PageSection>

      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="hl-skeleton h-40 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
          title="Não foi possível carregar o mapa técnico"
          description={error instanceof Error ? error.message : 'Tente novamente em instantes.'}
          actions={<Button variant="outline" onClick={() => void mutate()}>Tentar novamente</Button>}
          tone="strong"
          density="spacious"
        />
      )}

      {!isLoading && !error && points.length === 0 && (
        <EmptyState
          icon={<MapIcon className="h-6 w-6" aria-hidden="true" />}
          title="Nenhum ponto técnico cadastrado ainda."
          description="Cadastre registros, quadros, tubulações, caixas de inspeção, sensores e demais pontos para começar o mapa técnico do imóvel."
          actions={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar ponto técnico
              </Button>
            ) : null
          }
          tone="subtle"
          density="spacious"
        />
      )}

      {!isLoading && !error && points.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {points.map((point) => {
            const system = point.technical_system_id ? systemById.get(point.technical_system_id) : null;
            const room = point.room_id ? roomById.get(point.room_id) : null;
            const hasPosition = point.position_x != null && point.position_y != null;

            return (
              <article
                key={point.id}
                className="rounded-[var(--radius-xl)] border border-border-subtle bg-bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn('border-0', RISK_STYLES[point.risk_level])}>
                        Risco {riskLabel(point.risk_level)}
                      </Badge>
                      <span className="text-xs font-medium text-text-tertiary">{typeLabel(point.type)}</span>
                    </div>
                    <h2 className="mt-3 text-base font-medium leading-tight text-text-primary">{point.name}</h2>
                    {point.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">{point.description}</p>
                    )}
                  </div>
                  <MapIcon className="h-5 w-5 shrink-0 text-text-accent" aria-hidden="true" />
                </div>

                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
                      <dt className="text-xs text-text-tertiary">Sistema</dt>
                      <dd className="mt-0.5 truncate text-text-secondary">{system?.name ?? 'Sem sistema'}</dd>
                    </div>
                    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
                      <dt className="text-xs text-text-tertiary">Ambiente</dt>
                      <dd className="mt-0.5 truncate text-text-secondary">{room?.name ?? 'Sem ambiente'}</dd>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
                      <dt className="text-xs text-text-tertiary">Pavimento</dt>
                      <dd className="mt-0.5 text-text-secondary">{point.floor}</dd>
                    </div>
                    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
                      <dt className="text-xs text-text-tertiary">Coordenadas</dt>
                      <dd className="mt-0.5 text-text-secondary">
                        {hasPosition ? `${point.position_x}, ${point.position_y}` : 'Não posicionado'}
                      </dd>
                    </div>
                  </div>
                </dl>

                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(point)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-text-danger hover:bg-bg-danger"
                      loading={deletingId === point.id}
                      onClick={() => void removePoint(point)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remover
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPoint ? 'Editar ponto técnico' : 'Adicionar ponto técnico'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="point-name">Nome</Label>
                <Input
                  id="point-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Registro geral da cozinha"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((current) => ({ ...current, type: value as TechnicalPointType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POINT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Risco</Label>
                <Select
                  value={form.risk_level}
                  onValueChange={(value) => setForm((current) => ({ ...current, risk_level: value as TechnicalPointRiskLevel }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((risk) => (
                      <SelectItem key={risk.value} value={risk.value}>{risk.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Sistema técnico</Label>
                <Select
                  value={form.technical_system_id || NONE_VALUE}
                  onValueChange={(value) => setForm((current) => ({ ...current, technical_system_id: value === NONE_VALUE ? '' : value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sem sistema</SelectItem>
                    {systems.map((system) => (
                      <SelectItem key={system.id} value={system.id}>{system.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <Select
                  value={form.room_id || NONE_VALUE}
                  onValueChange={(value) => setForm((current) => ({ ...current, room_id: value === NONE_VALUE ? '' : value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sem ambiente</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="point-floor">Pavimento</Label>
                <Input
                  id="point-floor"
                  type="number"
                  value={form.floor}
                  onChange={(event) => setForm((current) => ({ ...current, floor: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="point-x">X (%)</Label>
                  <Input
                    id="point-x"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.position_x}
                    onChange={(event) => setForm((current) => ({ ...current, position_x: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="point-y">Y (%)</Label>
                  <Input
                    id="point-y"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.position_y}
                    onChange={(event) => setForm((current) => ({ ...current, position_y: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="point-description">Descrição</Label>
                <Textarea
                  id="point-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Como localizar, cuidados, relação com sistemas e observações de manutenção."
                  rows={4}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                {editingPoint ? 'Salvar alterações' : 'Adicionar ponto'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

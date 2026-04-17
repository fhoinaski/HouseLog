'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, DoorOpen, Wrench, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { propertiesApi, roomsApi, maintenanceApi } from '@/lib/api';
import { PROPERTY_TEMPLATES, FREQUENCY_LABELS } from '@/lib/templates';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STEPS = [
  { icon: Building2, label: 'Imóvel' },
  { icon: DoorOpen, label: 'Cômodos' },
  { icon: Wrench, label: 'Manutenções' },
];

const propertySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
  address: z.string().min(1, 'Endereço obrigatório'),
  city: z.string().min(1, 'Cidade obrigatória'),
});

type PropertyForm = z.infer<typeof propertySchema>;

interface SetupWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SetupWizard({ open, onOpenChange }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [propertyId, setPropertyId] = useState('');
  const [propertyType, setPropertyType] = useState<string>('house');
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
  const [selectedMaint, setSelectedMaint] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<PropertyForm>({
    resolver: zodResolver(propertySchema),
    defaultValues: { type: 'house' },
  });

  const watchType = watch('type');
  const template = PROPERTY_TEMPLATES[watchType ?? 'house'];

  function toggleRoom(i: number) {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleMaint(i: number) {
    setSelectedMaint((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function onPropertySubmit(data: PropertyForm) {
    try {
      const res = await propertiesApi.create(data);
      const id = res.property.id;
      setPropertyId(id);
      setPropertyType(data.type);
      // Pre-select all template rooms and maintenance
      setSelectedRooms(new Set(template.rooms.map((_, i) => i)));
      setSelectedMaint(new Set(template.maintenance.map((_, i) => i)));
      setStep(1);
    } catch (e) {
      toast.error('Erro ao criar imóvel', { description: (e as Error).message });
    }
  }

  async function applyRooms() {
    setSaving(true);
    try {
      const rooms = template.rooms.filter((_, i) => selectedRooms.has(i));
      await Promise.all(rooms.map((r) => roomsApi.create(propertyId, r)));
      setStep(2);
    } catch {
      toast.error('Erro ao criar cômodos');
    } finally {
      setSaving(false);
    }
  }

  async function applyMaintenance() {
    setSaving(true);
    try {
      const maint = template.maintenance.filter((_, i) => selectedMaint.has(i));
      await Promise.all(maint.map((m) => maintenanceApi.create(propertyId, m)));
      toast.success('Configuração concluída!');
      onOpenChange(false);
      router.push(`/properties/${propertyId}`);
    } catch {
      toast.error('Erro ao criar manutenções');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (propertyId) {
      router.push(`/properties/${propertyId}`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            Configuração inicial
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 py-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done ? 'bg-primary-600 text-white' : active ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300' : 'bg-slate-100 text-slate-400'
                )}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                <span className={cn('text-xs font-medium', active ? 'text-slate-900' : 'text-slate-400')}>{s.label}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
              </div>
            );
          })}
        </div>

        {/* Step 0: Create property */}
        {step === 0 && (
          <form onSubmit={handleSubmit(onPropertySubmit)} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="wz-name">Nome / Apelido *</Label>
              <Input id="wz-name" placeholder="Casa da Praia, Apto 302..." {...register('name')} />
              {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select defaultValue="house" onValueChange={(v) => setValue('type', v as PropertyForm['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="house">Casa</SelectItem>
                  <SelectItem value="apt">Apartamento</SelectItem>
                  <SelectItem value="commercial">Comercial</SelectItem>
                  <SelectItem value="warehouse">Galpão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Template preview */}
            <div className="rounded-lg bg-primary-50 border border-primary-200 px-3 py-2.5 text-xs text-primary-800">
              <p className="font-semibold mb-1">Modelo: {template.label}</p>
              <p className="text-primary-600">
                {template.rooms.length} cômodos · {template.maintenance.length} manutenções preventivas pré-configuradas
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wz-address">Endereço *</Label>
                <Input id="wz-address" placeholder="Rua das Flores, 123" {...register('address')} />
                {errors.address && <p className="text-xs text-rose-500">{errors.address.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wz-city">Cidade *</Label>
                <Input id="wz-city" placeholder="São Paulo" {...register('city')} />
                {errors.city && <p className="text-xs text-rose-500">{errors.city.message}</p>}
              </div>
            </div>

            <Button type="submit" loading={isSubmitting} className="w-full">
              Criar Imóvel e Continuar
            </Button>
          </form>
        )}

        {/* Step 1: Rooms */}
        {step === 1 && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-[var(--muted-foreground)]">
              Selecione os cômodos sugeridos para este tipo de imóvel.
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {PROPERTY_TEMPLATES[propertyType]?.rooms.map((room, i) => {
                const checked = selectedRooms.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleRoom(i)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors text-left',
                      checked ? 'border-primary-300 bg-primary-50' : 'border-[var(--border)] bg-[var(--card)]'
                    )}
                  >
                    {checked
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                      : <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    }
                    <span className="font-medium">{room.name}</span>
                    <span className="ml-auto text-xs text-[var(--muted-foreground)] capitalize">{room.type}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={saving}>
                Pular
              </Button>
              <Button className="flex-1" onClick={applyRooms} loading={saving}>
                Criar Cômodos ({selectedRooms.size})
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Maintenance */}
        {step === 2 && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-[var(--muted-foreground)]">
              Selecione as manutenções preventivas recomendadas.
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {PROPERTY_TEMPLATES[propertyType]?.maintenance.map((m, i) => {
                const checked = selectedMaint.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleMaint(i)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors text-left',
                      checked ? 'border-primary-300 bg-primary-50' : 'border-[var(--border)] bg-[var(--card)]'
                    )}
                  >
                    {checked
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                      : <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{m.title}</p>
                      {m.description && (
                        <p className="text-xs text-[var(--muted-foreground)] truncate">{m.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] shrink-0">
                      {FREQUENCY_LABELS[m.frequency]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose} disabled={saving}>
                Pular
              </Button>
              <Button className="flex-1" onClick={applyMaintenance} loading={saving}>
                Finalizar ({selectedMaint.size})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

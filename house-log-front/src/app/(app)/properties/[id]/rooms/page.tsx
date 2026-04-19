'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Home, Pencil, Trash2, BedDouble, Bath, ChefHat, Sofa, Car, Shirt, TreePine } from 'lucide-react';
import { roomsApi, type Room } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ROOM_TYPE_LABELS } from '@/lib/utils';

const ROOM_ICONS: Record<string, React.ElementType> = {
  bedroom: BedDouble, bathroom: Bath, kitchen: ChefHat, living: Sofa,
  garage: Car, laundry: Shirt, external: TreePine, roof: Home, other: Home,
};

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['bedroom', 'bathroom', 'kitchen', 'living', 'garage', 'laundry', 'external', 'roof', 'other']),
  floor: z.coerce.number().int().default(0),
  area_m2: z.coerce.number().positive().optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function RoomCard({
  room, onEdit, onDelete,
}: {
  room: Room;
  onEdit: (r: Room) => void;
  onDelete: (r: Room) => void;
}) {
  const Icon = ROOM_ICONS[room.type] ?? Home;
  const typeLabel = ROOM_TYPE_LABELS[room.type] ?? room.type;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
            <Icon className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{room.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
              <span className="text-xs text-muted-foreground">Andar {room.floor}</span>
              {room.area_m2 && (
                <span className="text-xs text-muted-foreground">{room.area_m2} m²</span>
              )}
            </div>
            {room.notes && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{room.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(room)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-(--color-danger) hover:bg-(--color-danger-light)"
              onClick={() => onDelete(room)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RoomsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data, mutate } = useSWR(['rooms', id], () => roomsApi.list(id));

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { floor: 0, type: 'other' },
  });

  const rooms = data?.rooms ?? [];
  const byFloor = rooms.reduce<Record<number, Room[]>>((acc, r) => {
    const f = r.floor;
    (acc[f] ??= []).push(r);
    return acc;
  }, {});
  const floors = Object.keys(byFloor).map(Number).sort((a, b) => a - b);

  function openNew() {
    setEditRoom(null);
    reset({ floor: 0, type: 'other' });
    setApiError(null);
    setDialogOpen(true);
  }

  function openEdit(room: Room) {
    setEditRoom(room);
    reset({
      name: room.name,
      type: room.type as FormData['type'],
      floor: room.floor,
      area_m2: room.area_m2 ?? undefined,
      notes: room.notes ?? undefined,
    });
    setApiError(null);
    setDialogOpen(true);
  }

  async function onSubmit(form: FormData) {
    setApiError(null);
    try {
      const payload = { ...form, area_m2: form.area_m2 === '' ? undefined : Number(form.area_m2) };
      if (editRoom) {
        await roomsApi.update(id, editRoom.id, payload);
        toast.success('Cômodo atualizado');
      } else {
        await roomsApi.create(id, payload);
        toast.success('Cômodo criado');
      }
      await mutate();
      setDialogOpen(false);
    } catch (e) {
      setApiError((e as Error).message);
    }
  }

  async function confirmDelete() {
    if (!deleteRoom) return;
    try {
      await roomsApi.delete(id, deleteRoom.id);
      await mutate();
      toast.success('Cômodo removido');
    } catch (e) {
      toast.error('Erro ao remover', { description: (e as Error).message });
    } finally {
      setDeleteRoom(null);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium">Cômodos</h2>
          <p className="text-sm text-muted-foreground">{rooms.length} cômodo{rooms.length !== 1 ? 's' : ''} cadastrado{rooms.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Novo Cômodo
        </Button>
      </div>

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Home className="mb-3 h-10 w-10 text-(--hl-text-tertiary)" />
          <p className="text-muted-foreground text-sm">Nenhum cômodo cadastrado</p>
          <Button variant="outline" className="mt-3" onClick={openNew}>
            <Plus className="h-4 w-4" /> Adicionar cômodo
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map((floor) => (
            <div key={floor}>
              <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-(--hl-text-tertiary)">
                {floor === 0 ? 'Térreo' : floor === -1 ? 'Subsolo' : `${floor}º Andar`}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {byFloor[floor]?.map((room) => (
                  <RoomCard key={room.id} room={room} onEdit={openEdit} onDelete={setDeleteRoom} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRoom ? 'Editar Cômodo' : 'Novo Cômodo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="room-name">Nome *</Label>
              <Input id="room-name" placeholder="Quarto principal, Banheiro social..." {...register('name')} />
              {errors.name && <p className="text-xs text-(--color-danger)">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  defaultValue={editRoom?.type ?? 'other'}
                  onValueChange={(v) => setValue('type', v as FormData['type'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room-floor">Andar</Label>
                <Input id="room-floor" type="number" {...register('floor')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room-area">Área (m²)</Label>
                <Input id="room-area" type="number" step="0.1" placeholder="15" {...register('area_m2')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="room-notes">Observações</Label>
              <Input id="room-notes" placeholder="Opcional..." {...register('notes')} />
            </div>

            {apiError && (
              <div className="rounded-lg border border-(--color-danger-border) bg-(--color-danger-light) px-3 py-2 text-sm text-(--color-danger)">
                {apiError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                {editRoom ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteRoom} onOpenChange={() => setDeleteRoom(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover Cômodo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover <strong>{deleteRoom?.name}</strong>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteRoom(null)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="flex-1">
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

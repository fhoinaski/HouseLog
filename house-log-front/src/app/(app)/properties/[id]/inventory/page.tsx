'use client';

import { use, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Loader2, Plus, Package, Filter, Search, AlertTriangle, QrCode, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { inventoryApi, roomsApi, type InventoryItem } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { INVENTORY_CATEGORY_LABELS, cn } from '@/lib/utils';

const schema = z.object({
  category: z.string().min(1),
  name: z.string().min(1, 'Nome obrigatório'),
  room_id: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color_code: z.string().optional(),
  quantity: z.coerce.number().min(0).default(0),
  unit: z.string().default('un'),
  reserve_qty: z.coerce.number().min(0).default(0),
  price_paid: z.coerce.number().positive().optional().or(z.literal('')),
  warranty_until: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function ItemCard({
  item,
  propertyId,
  uploading,
  onPhotoClick,
  onClick,
}: {
  item: InventoryItem;
  propertyId: string;
  uploading: boolean;
  onPhotoClick: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const isLowStock = item.quantity <= item.reserve_qty;

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-colors hover:bg-(--color-neutral-50) active:scale-[0.98]"
      onClick={onClick}
    >
      <div className="relative h-32 bg-(--hl-bg-subtle)">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-8 w-8 text-(--hl-text-tertiary)" />
          </div>
        )}

        {/* Upload overlay / spinner */}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        ) : (
          <button
            onClick={onPhotoClick}
            title="Alterar foto"
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/0 transition-colors',
              item.photo_url
                ? 'opacity-0 group-hover:opacity-100 group-hover:bg-black/30'
                : 'opacity-0 group-hover:opacity-100 group-hover:bg-black/10'
            )}
          >
            <Camera className="h-6 w-6 text-white" />
          </button>
        )}

        {item.color_code && (
          <div
            className="absolute bottom-2 right-2 h-5 w-5 rounded-full border-2 border-white"
            style={{ background: item.color_code }}
            title={item.color_code}
          />
        )}
        {isLowStock && (
          <div className="absolute top-2 left-2">
            <Badge variant="urgent" className="text-xs gap-1">
              <AlertTriangle className="h-3 w-3" />
              Baixo estoque
            </Badge>
          </div>
        )}
        {item.warranty_until && (
          <div className="absolute top-2 right-2" title={`Garantia até ${item.warranty_until}`}>
            <div className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full',
              new Date(item.warranty_until) < new Date() ? 'bg-(--color-danger)' : 'bg-(--color-success)'
            )}>
              <ShieldCheck className="h-3 w-3 text-white" />
            </div>
          </div>
        )}
        {/* QR button */}
        <Link
          href={`/properties/${propertyId}/inventory/${item.id}/qr`}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 left-2 h-6 w-6 flex items-center justify-center rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="Ver QR Code"
        >
          <QrCode className="h-3 w-3" />
        </Link>
      </div>
      <CardContent className="p-3">
        <Badge variant="secondary" className="text-xs mb-1.5">
          {INVENTORY_CATEGORY_LABELS[item.category] ?? item.category}
        </Badge>
        <p className="font-medium text-sm truncate">{item.name}</p>
        {item.brand && <p className="text-xs text-muted-foreground truncate">{item.brand}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-medium">{item.quantity} {item.unit}</span>
          {item.room_name && (
            <span className="text-xs text-muted-foreground truncate ml-2">{item.room_name}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mutate: globalMutate } = useSWRConfig();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const { data, mutate } = useSWR(
    ['inventory', id, categoryFilter, roomFilter],
    () => inventoryApi.list(id, {
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      room_id: roomFilter === 'all' ? undefined : roomFilter,
    })
  );

  const { data: roomsData } = useSWR(['rooms', id], () => roomsApi.list(id));

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 0, unit: 'un', reserve_qty: 0 },
  });

  const items = (data?.data ?? []).filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.brand?.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setEditItem(null);
    reset({ quantity: 0, unit: 'un', reserve_qty: 0 });
    setApiError(null);
    setDialogOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    reset({
      category: item.category,
      name: item.name,
      room_id: item.room_id ?? undefined,
      brand: item.brand ?? undefined,
      model: item.model ?? undefined,
      color_code: item.color_code ?? undefined,
      quantity: item.quantity,
      unit: item.unit,
      reserve_qty: item.reserve_qty,
      price_paid: item.price_paid ?? undefined,
      warranty_until: item.warranty_until ?? undefined,
      notes: item.notes ?? undefined,
    });
    setApiError(null);
    setDialogOpen(true);
  }

  function handlePhotoClick(e: React.MouseEvent, itemId: string) {
    e.stopPropagation();
    uploadTargetRef.current = itemId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = uploadTargetRef.current;
    if (!file || !itemId) return;
    // Reset so the same file can be re-selected later
    e.target.value = '';

    setUploadingId(itemId);
    try {
      await inventoryApi.uploadPhoto(id, itemId, file);
      await mutate();
    } catch {
      // silently fail — user can retry by clicking again
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
    }
  }

  async function onSubmit(form: FormData) {
    setApiError(null);
    try {
      const payload = { ...form, price_paid: form.price_paid === '' ? undefined : Number(form.price_paid) };
      if (editItem) {
        await inventoryApi.update(id, editItem.id, payload);
      } else {
        await inventoryApi.create(id, payload);
      }
      await mutate();
      void globalMutate(['dashboard', id]);
      setDialogOpen(false);
    } catch (e) {
      setApiError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">Inventário</h2>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Novo Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="h-11 w-full rounded-(--radius) border border-border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-(--field-focus-ring)"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(INVENTORY_CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roomFilter} onValueChange={setRoomFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Cômodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cômodos</SelectItem>
            {(roomsData?.rooms ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="mb-3 h-10 w-10 text-neutral-200" />
          <p className="text-muted-foreground text-sm">Nenhum item encontrado</p>
          <Button variant="outline" className="mt-3" onClick={openNew}>
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              propertyId={id}
              uploading={uploadingId === item.id}
              onPhotoClick={(e) => handlePhotoClick(e, item.id)}
              onClick={() => openEdit(item)}
            />
          ))}
        </div>
      )}

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Categoria *</Label>
                <Select
                  defaultValue={editItem?.category}
                  onValueChange={(v) => setValue('category', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVENTORY_CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-(--color-danger)">{errors.category.message}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-name">Nome *</Label>
                <Input id="item-name" placeholder="Tinta acrílica, cerâmica..." {...register('name')} />
                {errors.name && <p className="text-xs text-(--color-danger)">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" placeholder="Suvinil..." {...register('brand')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">Modelo</Label>
                <Input id="model" {...register('model')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="color-code">Código de cor</Label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-12 rounded border cursor-pointer" {...register('color_code')} />
                  <Input id="color-code" placeholder="var(--color-primary)" {...register('color_code')} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Cômodo</Label>
                <Select
                  defaultValue={editItem?.room_id ?? '__none__'}
                  onValueChange={(v) => setValue('room_id', v === '__none__' ? undefined : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {(roomsData?.rooms ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qty">Quantidade</Label>
                <Input id="qty" type="number" step="0.1" min={0} {...register('quantity')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unit">Unidade</Label>
                <Input id="unit" placeholder="un, L, kg, m²..." {...register('unit')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reserve">Estoque mínimo</Label>
                <Input id="reserve" type="number" step="0.1" min={0} {...register('reserve_qty')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price">Preço pago (R$)</Label>
                <Input id="price" type="number" step="0.01" placeholder="0.00" {...register('price_paid')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="warranty" className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-(--color-success)" />
                  Garantia até
                </Label>
                <Input id="warranty" type="date" {...register('warranty_until')} />
              </div>
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
                {editItem ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

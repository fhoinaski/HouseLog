'use client';

import type * as React from 'react';
import { use, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Camera,
  Filter,
  Loader2,
  Package,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricCard } from '@/components/ui/metric-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inventoryItemCardVariants, inventoryPhotoFrameVariants } from '@/components/ui/visual-system';
import { inventoryApi, roomsApi, type InventoryItem } from '@/lib/api';
import { cn, INVENTORY_CATEGORY_LABELS } from '@/lib/utils';

const schema = z.object({
  category: z.string().min(1, 'Categoria obrigatoria'),
  name: z.string().min(1, 'Nome obrigatorio'),
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
  onPhotoClick: (event: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const isLowStock = item.quantity <= item.reserve_qty;
  const warrantyExpired = Boolean(item.warranty_until && new Date(item.warranty_until) < new Date());

  return (
    <article
      className={inventoryItemCardVariants({ state: isLowStock ? 'lowStock' : 'default' })}
      onClick={onClick}
    >
      <div className={inventoryPhotoFrameVariants({ tone: item.photo_url ? 'default' : 'empty' })}>
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-8 w-8 text-text-tertiary" />
          </div>
        )}

        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        ) : (
          <button
            type="button"
            onClick={onPhotoClick}
            title="Alterar foto"
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-colors focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] group-hover/inventory:opacity-100',
              item.photo_url ? 'group-hover/inventory:bg-black/30' : 'group-hover/inventory:bg-black/10'
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
          <div className="absolute left-2 top-2">
            <Badge variant="urgent" className="gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Baixo estoque
            </Badge>
          </div>
        )}

        {item.warranty_until && (
          <div className="absolute right-2 top-2" title={`Garantia ate ${item.warranty_until}`}>
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)]',
                warrantyExpired ? 'bg-bg-danger text-text-danger' : 'bg-bg-success text-text-success'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
        )}

        <Link
          href={`/properties/${propertyId}/inventory/${item.id}/qr`}
          onClick={(event) => event.stopPropagation()}
          className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] group-hover/inventory:opacity-100"
          title="Ver QR Code"
        >
          <QrCode className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="p-3">
        <Badge variant="secondary" className="mb-1.5 text-xs">
          {INVENTORY_CATEGORY_LABELS[item.category] ?? item.category}
        </Badge>
        <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
        {item.brand && <p className="truncate text-xs text-text-secondary">{item.brand}</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">
            {item.quantity} {item.unit}
          </span>
          {item.room_name && <span className="truncate text-xs text-text-secondary">{item.room_name}</span>}
        </div>
      </div>
    </article>
  );
}

export default function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mutate: globalMutate } = useSWRConfig();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR(['inventory', id, categoryFilter, roomFilter], () =>
    inventoryApi.list(id, {
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      room_id: roomFilter === 'all' ? undefined : roomFilter,
    })
  );

  const { data: roomsData } = useSWR(['rooms', id], () => roomsApi.list(id));

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 0, unit: 'un', reserve_qty: 0 },
  });

  const allItems = data?.data ?? [];
  const items = allItems.filter((item) => {
    const term = search.trim().toLowerCase();
    return !term || item.name.toLowerCase().includes(term) || item.brand?.toLowerCase().includes(term);
  });
  const lowStockCount = allItems.filter((item) => item.quantity <= item.reserve_qty).length;
  const warrantyCount = allItems.filter((item) => Boolean(item.warranty_until)).length;
  const roomTrackedCount = allItems.filter((item) => Boolean(item.room_id)).length;

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

  function handlePhotoClick(event: React.MouseEvent, itemId: string) {
    event.stopPropagation();
    uploadTargetRef.current = itemId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const itemId = uploadTargetRef.current;
    if (!file || !itemId) return;

    event.target.value = '';
    setUploadingId(itemId);

    try {
      await inventoryApi.uploadPhoto(id, itemId, file);
      await mutate();
    } catch {
      toastPhotoError();
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
    }
  }

  function toastPhotoError() {
    setApiError('Nao foi possivel enviar a foto. Tente novamente.');
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
    } catch (submitError) {
      setApiError((submitError as Error).message);
    }
  }

  return (
    <div className="safe-bottom space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="editorial"
        eyebrow="Prontuario tecnico"
        title="Inventario tecnico"
        description="Materiais, equipamentos, reservas, garantias e rastreabilidade fisica que sustentam a operacao do imovel."
        actions={
          <Button type="button" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Novo item
          </Button>
        }
      />

      <PageSection
        title="Rastreabilidade do acervo fisico"
        description="Acompanhe itens por categoria, comodo, estoque minimo, garantia e QR Code para consulta em campo."
        tone="strong"
        density="editorial"
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Itens" value={allItems.length} helper="Registros filtrados" icon={Package} />
          <MetricCard
            label="Baixo estoque"
            value={lowStockCount}
            helper={lowStockCount > 0 ? 'Repor ou revisar reserva' : 'Reservas ok'}
            icon={AlertTriangle}
            tone={lowStockCount > 0 ? 'warning' : 'default'}
          />
          <MetricCard label="Com garantia" value={warrantyCount} helper="Itens com validade" icon={ShieldCheck} tone="success" />
          <MetricCard label="Com comodo" value={roomTrackedCount} helper="Localizacao rastreada" icon={QrCode} tone="accent" />
        </div>
      </PageSection>

      <PageSection
        title="Itens do inventario"
        description="Filtre o acervo tecnico para localizar materiais, equipamentos e reservas por uso operacional."
        density="editorial"
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative min-w-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar item"
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(INVENTORY_CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Comodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os comodos</SelectItem>
                {(roomsData?.rooms ?? []).map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {error ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Nao foi possivel carregar o inventario."
            description="Verifique a conexao e tente novamente para acessar o acervo tecnico do imovel."
            tone="strong"
            actions={<Button variant="outline" onClick={() => void mutate()}>Tentar novamente</Button>}
          />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="hl-skeleton h-52 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={allItems.length === 0 ? 'Nenhum item no inventario tecnico' : 'Nenhum item encontrado'}
            description={
              allItems.length === 0
                ? 'Adicione materiais, equipamentos e reservas para compor a rastreabilidade tecnica do imovel.'
                : 'Ajuste busca, categoria ou comodo para localizar outro registro do acervo.'
            }
            tone="subtle"
            density="spacious"
            actions={
              <Button type="button" variant="outline" onClick={openNew}>
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                propertyId={id}
                uploading={uploadingId === item.id}
                onPhotoClick={(event) => handlePhotoClick(event, item.id)}
                onClick={() => openEdit(item)}
              />
            ))}
          </div>
        )}
      </PageSection>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar item' : 'Novo item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-2 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Categoria *</Label>
                <Select defaultValue={editItem?.category} onValueChange={(value) => setValue('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVENTORY_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-text-danger">{errors.category.message}</p>}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="item-name">Nome *</Label>
                <Input id="item-name" placeholder="Tinta acrilica, ceramica, filtro..." {...register('name')} />
                {errors.name && <p className="text-xs text-text-danger">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" placeholder="Marca ou fabricante" {...register('brand')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">Modelo</Label>
                <Input id="model" placeholder="Codigo ou referencia" {...register('model')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="color-code">Codigo de cor</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-11 w-12 cursor-pointer rounded-[var(--radius-md)] border-half border-border-subtle"
                    {...register('color_code')}
                  />
                  <Input id="color-code" placeholder="#FFFFFF" {...register('color_code')} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Comodo</Label>
                <Select
                  defaultValue={editItem?.room_id ?? '__none__'}
                  onValueChange={(value) => setValue('room_id', value === '__none__' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {(roomsData?.rooms ?? []).map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
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
                <Input id="unit" placeholder="un, L, kg, m2" {...register('unit')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reserve">Estoque minimo</Label>
                <Input id="reserve" type="number" step="0.1" min={0} {...register('reserve_qty')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price">Preco pago (R$)</Label>
                <Input id="price" type="number" step="0.01" placeholder="0.00" {...register('price_paid')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="warranty" className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-text-success" />
                  Garantia ate
                </Label>
                <Input id="warranty" type="date" {...register('warranty_until')} />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Observacoes</Label>
                <Input id="notes" placeholder="Detalhes de uso, lote ou local de armazenamento" {...register('notes')} />
              </div>
            </div>

            {apiError && (
              <div className="rounded-[var(--radius-md)] border-half border-border-danger bg-bg-danger px-3 py-2 text-sm text-text-danger">
                {apiError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
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

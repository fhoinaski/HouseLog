'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Camera, Trash2 } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
  address: z.string().min(1, 'Endereço obrigatório'),
  city: z.string().min(1, 'Cidade obrigatória'),
  area_m2: z.coerce.number().positive().optional().or(z.literal('')),
  year_built: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal('')),
  floors: z.coerce.number().int().min(1).default(1),
  structure: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverPreview, setCoverPreview] = useState<string | null | undefined>(undefined);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: propData } = useSWR(['property', id], () => propertiesApi.get(id));
  const property = propData?.property;

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Pre-populate form when property loads
  useEffect(() => {
    if (property) {
      reset({
        name: property.name,
        type: property.type,
        address: property.address,
        city: property.city,
        area_m2: property.area_m2 ?? undefined,
        year_built: property.year_built ?? undefined,
        floors: property.floors,
        structure: property.structure ?? undefined,
      });
    }
  }, [property, reset]);

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function onSubmit(data: FormData) {
    setApiError(null);
    try {
      // Upload cover first if changed
      let coverUrl = coverPreview === null ? null : (property?.cover_url ?? null);
      if (coverFile) {
        setUploadingCover(true);
        const fd = new FormData();
        fd.append('file', coverFile);
        const token = localStorage.getItem('hl_token');
        const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787/api/v1';
        const res = await fetch(`${BASE}/properties/${id}/cover`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (res.ok) {
          const json = await res.json() as { cover_url: string };
          coverUrl = json.cover_url;
        }
        setUploadingCover(false);
      }

      await propertiesApi.update(id, {
        ...data,
        area_m2: data.area_m2 === '' ? undefined : Number(data.area_m2),
        year_built: data.year_built === '' ? undefined : Number(data.year_built),
        cover_url: coverUrl ?? undefined,
      });

      toast.success('Imóvel atualizado');
      router.push(`/properties/${id}`);
    } catch (e) {
      setApiError((e as Error).message || 'Erro ao salvar');
    }
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const effectiveCoverPreview = coverPreview === undefined ? property.cover_url : coverPreview;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-medium">Editar imóvel</h1>
      </div>

      {/* Cover photo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Foto de Capa</CardTitle></CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="relative h-48 overflow-hidden rounded-xl bg-neutral-100">
            {effectiveCoverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={effectiveCoverPreview} alt="capa" className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-neutral-400">
                Sem foto de capa
              </div>
            )}
            <div className="absolute bottom-3 right-3 flex gap-2">
              <Button
                type="button" size="sm" variant="outline"
                className="bg-white/90 hover:bg-white"
                onClick={() => coverRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                {effectiveCoverPreview ? 'Trocar' : 'Adicionar'}
              </Button>
              {effectiveCoverPreview && (
                <Button
                  type="button" size="icon" variant="outline"
                  className="bg-white/90 hover:bg-white h-8 w-8"
                  onClick={() => { setCoverPreview(null); setCoverFile(null); }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-(--color-danger)" />
                </Button>
              )}
            </div>
          </div>
          <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" onChange={handleCoverSelect} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Informações do Imóvel</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="name">Nome / Apelido *</Label>
                <Input id="name" placeholder="Casa da Praia, Apto 302..." {...register('name')} />
                {errors.name && <p className="text-xs text-(--color-danger)">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={property.type}
                  onValueChange={(v) => setValue('type', v as FormData['type'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="house">Casa</SelectItem>
                    <SelectItem value="apt">Apartamento</SelectItem>
                    <SelectItem value="commercial">Comercial</SelectItem>
                    <SelectItem value="warehouse">Galpão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="floors">Andares</Label>
                <Input id="floors" type="number" min={1} {...register('floors')} />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="address">Endereço *</Label>
                <Input id="address" placeholder="Rua das Flores, 123" {...register('address')} />
                {errors.address && <p className="text-xs text-(--color-danger)">{errors.address.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade *</Label>
                <Input id="city" placeholder="São Paulo" {...register('city')} />
                {errors.city && <p className="text-xs text-(--color-danger)">{errors.city.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area_m2">Área (m²)</Label>
                <Input id="area_m2" type="number" step="0.1" placeholder="120" {...register('area_m2')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="year_built">Ano de Construção</Label>
                <Input id="year_built" type="number" min={1800} max={2100} placeholder="1990"
                  {...register('year_built')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="structure">Estrutura</Label>
                <Input id="structure" placeholder="Concreto armado, alvenaria..." {...register('structure')} />
              </div>
            </div>

            {apiError && (
              <div className="rounded-lg border border-(--color-danger-border) bg-(--color-danger-light) px-4 py-3 text-sm text-(--color-danger)">
                {apiError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting || uploadingCover}>
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

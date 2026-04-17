'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

export default function NewPropertyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'house', floors: 1 },
  });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await propertiesApi.create({
        ...data,
        area_m2: data.area_m2 === '' ? undefined : Number(data.area_m2),
        year_built: data.year_built === '' ? undefined : Number(data.year_built),
      });
      router.push(`/properties/${res.property.id}`);
    } catch (e) {
      setError((e as Error).message || 'Erro ao criar imóvel');
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Novo Imóvel</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Imóvel</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="name">Nome / Apelido *</Label>
                <Input id="name" placeholder="Casa da Praia, Apto 302..." {...register('name')} />
                {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select defaultValue="house" onValueChange={(v) => setValue('type', v as FormData['type'])}>
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
                <Input id="floors" type="number" min={1} defaultValue={1} {...register('floors')} />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="address">Endereço *</Label>
                <Input id="address" placeholder="Rua das Flores, 123" {...register('address')} />
                {errors.address && <p className="text-xs text-rose-500">{errors.address.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade *</Label>
                <Input id="city" placeholder="São Paulo" {...register('city')} />
                {errors.city && <p className="text-xs text-rose-500">{errors.city.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area_m2">Área (m²)</Label>
                <Input id="area_m2" type="number" step="0.1" placeholder="120" {...register('area_m2')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="year_built">Ano de Construção</Label>
                <Input id="year_built" type="number" min={1800} max={2100} placeholder="1990" {...register('year_built')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="structure">Estrutura</Label>
                <Input id="structure" placeholder="Concreto armado, alvenaria..." {...register('structure')} />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Criar Imóvel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, ImagePlus } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
  address: z.string().min(1, 'Endereço obrigatório'),
  city: z.string().min(1, 'Cidade obrigatória'),
  area_m2: z.coerce.number().positive().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function NewPropertyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'house' },
  });

  const watchType = watch('type');

  const typeLabel = useMemo(() => {
    if (watchType === 'house') return 'Casa';
    if (watchType === 'apt') return 'Apartamento';
    if (watchType === 'commercial') return 'Comercial';
    return 'Galpão';
  }, [watchType]);

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await propertiesApi.create({
        ...data,
        area_m2: data.area_m2 === '' ? undefined : Number(data.area_m2),
      });
      router.push(`/properties/${res.property.id}`);
    } catch (e) {
      setError((e as Error).message || 'Erro ao criar imóvel');
    }
  }

  function onPickCover() {
    coverInputRef.current?.click();
  }

  function onCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-28 pt-20">
      <div className="pointer-events-none fixed left-0 top-0 -z-10 h-96 w-full bg-linear-to-b from-zinc-800 to-transparent" />

      <header className="fixed left-0 top-0 z-40 flex h-16 w-full items-center justify-between bg-background/80 px-6 shadow-[0px_40px_60px_rgba(6,14,32,0.4)] backdrop-blur-lg">
        <button
          aria-label="Voltar"
          className="-ml-2 rounded-full p-2 text-primary-400 transition-all duration-300 hover:bg-zinc-600 active:scale-95"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="pr-10 text-center text-xl font-semibold tracking-tight text-primary-400">Novo Imóvel</h1>
      </header>

      <main className="relative z-10 mx-auto mt-6 flex w-full max-w-3xl flex-col gap-8 px-6 pb-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-5xl font-extrabold tracking-tight text-primary-400">Adicionar Propriedade</h2>
          <p className="max-w-lg text-xl leading-relaxed font-medium tracking-wide text-[#c4c5d9]">
            Insira os dados fundamentais para integrar esta propriedade ao seu portfólio de gestão.
          </p>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          <button
            type="button"
            onClick={onPickCover}
            className="group relative flex min-h-55 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-zinc-500/10 bg-zinc-700 p-6 transition-all duration-300 hover:scale-[1.01] hover:bg-zinc-600"
          >
            <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-zinc-600/20 to-transparent" />
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Prévia da capa" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className={cn('z-10 flex flex-col items-center gap-3 text-center', coverPreview ? 'bg-background/65 rounded-xl px-4 py-3 backdrop-blur-sm' : '')}>
              <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-600/50 text-primary-400 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-md">
                <ImagePlus className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-[#dae2fd]">Imagem de Capa</h3>
              <p className="max-w-55 text-sm leading-tight text-[#c4c5d9]">
                Toque para fazer upload da foto principal do imóvel.
              </p>
            </div>
            <input ref={coverInputRef} accept="image/*" className="hidden" type="file" onChange={onCoverChange} />
          </button>

          <Card className="rounded-xl border-zinc-500/20 bg-zinc-800/70 p-1 shadow-[0px_20px_40px_rgba(6,14,32,0.4)]">
            <CardContent className="flex flex-col gap-4 p-0">
              <div className="rounded-lg bg-background p-4 transition-all duration-300 focus-within:bg-zinc-600 focus-within:ring-1 focus-within:ring-primary-400/20">
                <label className="mb-2 block text-label-caps text-primary-400">Nome da propriedade</label>
                <Input id="name" placeholder="Ex: Edifício Aurora" className="h-auto border-0 bg-transparent p-0 text-4xl font-medium placeholder:text-[#c4c5d9]/50 focus-visible:ring-0" {...register('name')} />
                {errors.name && <p className="mt-2 text-xs text-[#ffb4ab]">{errors.name.message}</p>}
              </div>

              <div className="rounded-lg bg-background p-4 transition-all duration-300 focus-within:bg-zinc-600 focus-within:ring-1 focus-within:ring-primary-400/20">
                <label className="mb-2 block text-label-caps text-primary-400">Endereço completo</label>
                <Input id="address" placeholder="Av. Paulista, 1000 - Bela Vista" className="h-auto border-0 bg-transparent p-0 text-4xl font-medium placeholder:text-[#c4c5d9]/50 focus-visible:ring-0" {...register('address')} />
                {errors.address && <p className="mt-2 text-xs text-[#ffb4ab]">{errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="relative rounded-lg bg-background p-4 transition-all duration-300 focus-within:bg-zinc-600 focus-within:ring-1 focus-within:ring-primary-400/20">
                  <label className="mb-2 block text-label-caps text-primary-400">Tipo de imóvel</label>
                  <Select defaultValue="house" onValueChange={(value) => setValue('type', value as FormData['type'])}>
                    <SelectTrigger className="h-auto border-0 bg-transparent p-0 text-4xl font-medium text-[#dae2fd] focus:ring-0">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="house">Casa</SelectItem>
                      <SelectItem value="apt">Apartamento</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                      <SelectItem value="warehouse">Galpão</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-[#c4c5d9]">Selecionado: {typeLabel}</p>
                </div>

                <div className="rounded-lg bg-background p-4 transition-all duration-300 focus-within:bg-zinc-600 focus-within:ring-1 focus-within:ring-primary-400/20">
                  <label className="mb-2 block text-label-caps text-primary-400">Área total (m²)</label>
                  <div className="flex items-center gap-2">
                    <Input id="area_m2" type="number" step="0.1" placeholder="0" className="h-auto border-0 bg-transparent p-0 text-4xl font-medium placeholder:text-[#c4c5d9]/50 focus-visible:ring-0" {...register('area_m2')} />
                    <span className="text-2xl font-medium text-[#c4c5d9]">m²</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-background p-4 transition-all duration-300 focus-within:bg-zinc-600 focus-within:ring-1 focus-within:ring-primary-400/20">
                <label className="mb-2 block text-label-caps text-primary-400">Cidade</label>
                <Input id="city" placeholder="São Paulo" className="h-auto border-0 bg-transparent p-0 text-4xl font-medium placeholder:text-[#c4c5d9]/50 focus-visible:ring-0" {...register('city')} />
                {errors.city && <p className="mt-2 text-xs text-[#ffb4ab]">{errors.city.message}</p>}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md bg-[#93000a]/30 px-4 py-3 text-sm text-[#ffdad6]">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-8 w-full text-3xl font-bold">
            Cadastrar Imóvel
            <ArrowRight className="h-6 w-6" />
          </Button>
        </form>
      </main>
    </div>
  );
}

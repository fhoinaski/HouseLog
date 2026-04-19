'use client';

import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatorio'),
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
  address: z.string().min(1, 'Endereco obrigatorio'),
  city: z.string().min(1, 'Cidade obrigatoria'),
  area_m2: z.coerce.number().positive().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function NewPropertyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'house' },
  });

  const watchType = useWatch({ control, name: 'type' });

  const typeLabel = useMemo(() => {
    if (watchType === 'house') return 'Casa';
    if (watchType === 'apt') return 'Apartamento';
    if (watchType === 'commercial') return 'Comercial';
    return 'Galpao';
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
      setError((e as Error).message || 'Erro ao criar imovel');
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
    <div className="safe-top safe-bottom min-h-screen overflow-x-hidden bg-bg-page">
      <header className="fixed left-0 top-0 z-40 flex h-13 w-full items-center justify-between border-b border-half border-border-subtle bg-bg-surface px-4">
        <Button variant="ghost" size="icon" aria-label="Voltar" className="-ml-1" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="pr-10 text-center text-md font-medium tracking-tight text-text-primary">Novo imovel</h1>
      </header>

      <main className="mx-auto mt-4 flex w-full max-w-3xl flex-col gap-4 px-4 pb-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium tracking-tight text-text-primary">Adicionar propriedade</h2>
          <p className="max-w-lg text-sm leading-relaxed text-text-secondary">
            Insira os dados fundamentais para integrar esta propriedade ao seu portfolio de gestao.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <button
            type="button"
            onClick={onPickCover}
            className="hl-btn-ghost group relative flex min-h-55 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-half border-border-subtle bg-bg-surface p-6"
            aria-label="Selecionar imagem de capa"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Previa da capa" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className={cn('z-10 flex flex-col items-center gap-3 text-center', coverPreview ? 'rounded-xl bg-bg-surface px-4 py-3' : '')}>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-bg-accent-subtle text-text-accent">
                <ImagePlus className="h-8 w-8" />
              </div>
              <h3 className="text-md font-medium text-text-primary">Imagem de capa</h3>
              <p className="max-w-55 text-xs leading-tight text-text-secondary">
                Toque para fazer upload da foto principal do imovel.
              </p>
            </div>
            <input ref={coverInputRef} accept="image/*" className="hl-input sr-only" type="file" onChange={onCoverChange} />
          </button>

          <Card className="p-1">
            <CardContent className="flex flex-col gap-4 p-0">
              <div className="rounded-lg bg-bg-surface p-4 transition-colors focus-within:bg-bg-subtle">
                <label htmlFor="name" className="hl-label mb-2 text-text-tertiary">Nome da propriedade</label>
                <Input id="name" placeholder="Ex.: Edificio Aurora" className="border-0 bg-transparent p-0" {...register('name')} />
                {errors.name && <p className="hl-error mt-2">{errors.name.message}</p>}
              </div>

              <div className="rounded-lg bg-bg-surface p-4 transition-colors focus-within:bg-bg-subtle">
                <label htmlFor="address" className="hl-label mb-2 text-text-tertiary">Endereco completo</label>
                <Input id="address" placeholder="Av. Paulista, 1000 - Bela Vista" className="border-0 bg-transparent p-0" {...register('address')} />
                {errors.address && <p className="hl-error mt-2">{errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="relative rounded-lg bg-bg-surface p-4 transition-colors focus-within:bg-bg-subtle">
                  <label className="hl-label mb-2 text-text-tertiary">Tipo de imovel</label>
                  <Select defaultValue="house" onValueChange={(value) => setValue('type', value as FormData['type'])}>
                    <SelectTrigger className="border-0 bg-transparent p-0 text-text-primary">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="house">Casa</SelectItem>
                      <SelectItem value="apt">Apartamento</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                      <SelectItem value="warehouse">Galpao</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-text-secondary">Selecionado: {typeLabel}</p>
                </div>

                <div className="rounded-lg bg-bg-surface p-4 transition-colors focus-within:bg-bg-subtle">
                  <label htmlFor="area_m2" className="hl-label mb-2 text-text-tertiary">Area total (m2)</label>
                  <div className="flex items-center gap-2">
                    <Input id="area_m2" type="number" step="0.1" placeholder="0" className="border-0 bg-transparent p-0" {...register('area_m2')} />
                    <span className="text-sm text-text-secondary">m2</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-bg-surface p-4 transition-colors focus-within:bg-bg-subtle">
                <label htmlFor="city" className="hl-label mb-2 text-text-tertiary">Cidade</label>
                <Input id="city" placeholder="Sao Paulo" className="border-0 bg-transparent p-0" {...register('city')} />
                {errors.city && <p className="hl-error mt-2">{errors.city.message}</p>}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-lg border-half border-border-danger bg-bg-danger px-4 py-3 text-sm text-text-danger">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
            Cadastrar imovel
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}

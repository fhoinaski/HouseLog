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

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'house' },
  });

  const watchType = useWatch({ control, name: 'type' });

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
    <div className="min-h-screen overflow-x-hidden bg-bg-page pb-20 pt-13">
      <header className="fixed left-0 top-0 z-40 flex h-13 w-full items-center justify-between border-b border-border-subtle bg-bg-surface px-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Voltar"
          className="-ml-1"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="pr-10 text-center text-[15px] font-medium tracking-tight text-text-primary">Novo imóvel</h1>
      </header>

      <main className="mx-auto mt-4 flex w-full max-w-3xl flex-col gap-4 px-4 pb-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] font-medium tracking-tight text-text-primary">Adicionar propriedade</h2>
          <p className="max-w-lg text-[13px] leading-relaxed text-text-secondary">
            Insira os dados fundamentais para integrar esta propriedade ao seu portfólio de gestão.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <button
            type="button"
            onClick={onPickCover}
            className="group relative flex min-h-55 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-half border-border-subtle bg-bg-surface p-6 transition-colors hover:bg-bg-subtle active:scale-[0.98]"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Prévia da capa" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className={cn('z-10 flex flex-col items-center gap-3 text-center', coverPreview ? 'rounded-xl bg-bg-surface px-4 py-3' : '')}>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-bg-accent-subtle text-text-accent">
                <ImagePlus className="h-8 w-8" />
              </div>
              <h3 className="text-[15px] font-medium text-text-primary">Imagem de capa</h3>
              <p className="max-w-55 text-[12px] leading-tight text-text-secondary">
                Toque para fazer upload da foto principal do imóvel.
              </p>
            </div>
            <input ref={coverInputRef} accept="image/*" className="hidden" type="file" onChange={onCoverChange} />
          </button>

          <Card className="rounded-xl border-neutral-100 bg-(--hl-bg-card) p-1">
            <CardContent className="flex flex-col gap-4 p-0">
              <div className="rounded-lg bg-(--hl-bg-card) p-4 transition-colors focus-within:bg-(--color-neutral-50)">
                <label className="mb-2 block text-label-caps text-(--hl-text-tertiary)">Nome da propriedade</label>
                <Input id="name" placeholder="Ex: Edifício Aurora" className="h-11 border-0 border-b-[1.5px] border-(--field-border) bg-transparent p-0 text-[15px] font-medium placeholder:text-(--field-placeholder) focus-visible:border-(--field-border-strong)" {...register('name')} />
                {errors.name && <p className="mt-2 text-[12px] text-(--color-danger)">{errors.name.message}</p>}
              </div>

              <div className="rounded-lg bg-(--hl-bg-card) p-4 transition-colors focus-within:bg-(--color-neutral-50)">
                <label className="mb-2 block text-label-caps text-(--hl-text-tertiary)">Endereço completo</label>
                <Input id="address" placeholder="Av. Paulista, 1000 - Bela Vista" className="h-11 border-0 border-b-[1.5px] border-(--field-border) bg-transparent p-0 text-[15px] font-medium placeholder:text-(--field-placeholder) focus-visible:border-(--field-border-strong)" {...register('address')} />
                {errors.address && <p className="mt-2 text-[12px] text-(--color-danger)">{errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="relative rounded-lg bg-(--hl-bg-card) p-4 transition-colors focus-within:bg-(--color-neutral-50)">
                  <label className="mb-2 block text-label-caps text-(--hl-text-tertiary)">Tipo de imóvel</label>
                  <Select defaultValue="house" onValueChange={(value) => setValue('type', value as FormData['type'])}>
                    <SelectTrigger className="h-11 border-0 border-b-[1.5px] border-(--field-border) bg-transparent p-0 text-[15px] font-medium text-(--hl-text-primary) focus:border-(--field-border-strong)">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="house">Casa</SelectItem>
                      <SelectItem value="apt">Apartamento</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                      <SelectItem value="warehouse">Galpão</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-[12px] text-(--hl-text-secondary)">Selecionado: {typeLabel}</p>
                </div>

                <div className="rounded-lg bg-(--hl-bg-card) p-4 transition-colors focus-within:bg-(--color-neutral-50)">
                  <label className="mb-2 block text-label-caps text-(--hl-text-tertiary)">Área total (m²)</label>
                  <div className="flex items-center gap-2">
                    <Input id="area_m2" type="number" step="0.1" placeholder="0" className="h-11 border-0 border-b-[1.5px] border-(--field-border) bg-transparent p-0 text-[15px] font-medium placeholder:text-(--field-placeholder) focus-visible:border-(--field-border-strong)" {...register('area_m2')} />
                    <span className="text-[13px] text-(--hl-text-secondary)">m²</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-(--hl-bg-card) p-4 transition-colors focus-within:bg-(--color-neutral-50)">
                <label className="mb-2 block text-label-caps text-(--hl-text-tertiary)">Cidade</label>
                <Input id="city" placeholder="São Paulo" className="h-11 border-0 border-b-[1.5px] border-(--field-border) bg-transparent p-0 text-[15px] font-medium placeholder:text-(--field-placeholder) focus-visible:border-(--field-border-strong)" {...register('city')} />
                {errors.city && <p className="mt-2 text-[12px] text-(--color-danger)">{errors.city.message}</p>}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-lg border border-(--color-danger-border) bg-(--color-danger-light) px-4 py-3 text-[13px] text-(--color-danger)">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
            Cadastrar imóvel
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  History,
  Home,
  ImagePlus,
  MapPin,
  Ruler,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { PageContainer } from '@/components/layout/page-container';
import {
  buildPropertyCreatePayload,
  propertyCreateFormSchema,
  type PropertyCreateFormData,
} from '@/components/properties/property-create-form-model';

const propertyTypeLabels: Record<PropertyCreateFormData['type'], string> = {
  house: 'Casa',
  apt: 'Apartamento',
  commercial: 'Comercial',
  warehouse: 'Galpao',
};

const summaryItems = [
  { icon: ClipboardList, label: 'Perfil tecnico do imovel' },
  { icon: Home, label: 'Ambientes e historico' },
  { icon: FileCheck2, label: 'Documentos e garantias' },
  { icon: Wrench, label: 'Chamados e ordens de servico' },
  { icon: History, label: 'Dossie tecnico futuro' },
];

export default function NewPropertyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PropertyCreateFormData>({
    resolver: zodResolver(propertyCreateFormSchema),
    defaultValues: { type: 'house' },
  });

  const watchType = useWatch({ control, name: 'type' });
  const typeLabel = useMemo(() => propertyTypeLabels[watchType ?? 'house'], [watchType]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  async function onSubmit(data: PropertyCreateFormData) {
    setError(null);
    try {
      const res = await propertiesApi.create(buildPropertyCreatePayload(data));
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

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
  }

  return (
    <PageContainer className="space-y-6 pb-24 md:pb-8" variant="default">
      <div className="flex flex-col gap-4 border-b border-hl-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit -translate-x-2 text-hl-text-muted"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hl-primary">Novo imovel</p>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-hl-text sm:text-3xl">Cadastrar imovel</h1>
              <p className="max-w-2xl text-sm leading-6 text-hl-text-muted sm:text-base">
                Crie o perfil tecnico 360 do imovel para centralizar historico, documentos, chamados, garantias e servicos.
              </p>
            </div>
          </div>
        </div>

        <Button type="submit" form="property-create-form" loading={isSubmitting} className="hidden lg:inline-flex">
          Cadastrar imovel
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <form id="property-create-form" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-[var(--hl-radius-card)] border border-[color-mix(in_srgb,var(--hl-danger)_30%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-danger)_9%,var(--hl-surface))] px-4 py-3 text-sm text-hl-danger"
            >
              {error}
            </div>
          )}

          <FormSection
            eyebrow="Identificacao"
            title="Dados principais"
            description="Defina como este ativo aparecera no portfolio tecnico."
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
              <Field label="Nome da propriedade" error={errors.name?.message} htmlFor="name">
                <Input
                  id="name"
                  placeholder="Ex.: Residencia Jardim Europa"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  {...register('name')}
                />
              </Field>

              <Field label="Tipo de imovel" htmlFor="type">
                <Select
                  defaultValue="house"
                  onValueChange={(value) => setValue('type', value as PropertyCreateFormData['type'], { shouldValidate: true })}
                >
                  <SelectTrigger id="type" aria-label="Tipo de imovel">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="house">Casa</SelectItem>
                    <SelectItem value="apt">Apartamento</SelectItem>
                    <SelectItem value="commercial">Comercial</SelectItem>
                    <SelectItem value="warehouse">Galpao</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Area total" error={errors.area_m2?.message} htmlFor="area_m2" hint="Opcional, em m2.">
                <div className="relative">
                  <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hl-text-muted" />
                  <Input
                    id="area_m2"
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    placeholder="280"
                    className="pl-9 pr-12"
                    aria-invalid={!!errors.area_m2}
                    aria-describedby={errors.area_m2 ? 'area_m2-error' : undefined}
                    {...register('area_m2')}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-hl-text-muted">m2</span>
                </div>
              </Field>

              <Field label="Pavimentos" error={errors.floors?.message} htmlFor="floors" hint="Opcional.">
                <Input
                  id="floors"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="2"
                  aria-invalid={!!errors.floors}
                  aria-describedby={errors.floors ? 'floors-error' : undefined}
                  {...register('floors')}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            eyebrow="Localizacao"
            title="Endereco do ativo"
            description="Use um endereco reconhecivel para facilitar operacao, documentos e chamados."
          >
            <Field label="Endereco completo" error={errors.address?.message} htmlFor="address">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hl-text-muted" />
                <Input
                  id="address"
                  placeholder="Av. Paulista, 1000 - Bela Vista"
                  className="pl-9"
                  aria-invalid={!!errors.address}
                  aria-describedby={errors.address ? 'address-error' : undefined}
                  {...register('address')}
                />
              </div>
            </Field>

            <Field label="Cidade" error={errors.city?.message} htmlFor="city">
              <Input
                id="city"
                placeholder="Sao Paulo"
                aria-invalid={!!errors.city}
                aria-describedby={errors.city ? 'city-error' : undefined}
                {...register('city')}
              />
            </Field>
          </FormSection>

          <FormSection
            eyebrow="Contexto tecnico"
            title="Base construtiva"
            description="Informacoes opcionais que ajudam a iniciar o prontuario tecnico com mais contexto."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ano de construcao" error={errors.year_built?.message} htmlFor="year_built" hint="Opcional.">
                <Input
                  id="year_built"
                  type="number"
                  min="1800"
                  max="2100"
                  step="1"
                  inputMode="numeric"
                  placeholder="2018"
                  aria-invalid={!!errors.year_built}
                  aria-describedby={errors.year_built ? 'year_built-error' : undefined}
                  {...register('year_built')}
                />
              </Field>

              <Field label="Estrutura" error={errors.structure?.message} htmlFor="structure" hint="Opcional.">
                <Input
                  id="structure"
                  placeholder="Concreto armado, alvenaria estrutural..."
                  aria-invalid={!!errors.structure}
                  aria-describedby={errors.structure ? 'structure-error' : undefined}
                  {...register('structure')}
                />
              </Field>
            </div>
          </FormSection>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card variant="section" className="overflow-hidden border-hl-border shadow-hl-subtle">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-hl-primary">Imagem de capa</p>
                <p className="text-sm leading-5 text-hl-text-muted">
                  Foto opcional para identificacao visual. O upload real da capa sera tratado pelo fluxo de midia existente quando disponivel.
                </p>
              </div>

              <button
                type="button"
                onClick={onPickCover}
                className={cn(
                  'group relative flex aspect-[4/3] w-full overflow-hidden rounded-[var(--hl-radius-card)] border border-dashed border-hl-border bg-hl-surface-muted text-left transition hover:border-[color-mix(in_srgb,var(--hl-primary)_35%,var(--hl-border))] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)]',
                  coverPreview ? 'border-solid bg-hl-surface' : '',
                )}
                aria-label="Selecionar imagem de capa"
              >
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="Previa da capa" className="absolute inset-0 h-full w-full object-cover" />
                ) : null}
                <span
                  className={cn(
                    'relative z-10 m-auto flex max-w-56 flex-col items-center gap-3 px-4 text-center',
                    coverPreview ? 'rounded-[var(--hl-radius-card)] bg-hl-surface/95 py-4 shadow-hl-subtle' : '',
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface text-hl-primary shadow-hl-subtle">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-hl-text">{coverPreview ? 'Trocar imagem' : 'Adicionar capa'}</span>
                  <span className="text-xs leading-5 text-hl-text-muted">JPG, PNG ou WebP. Apenas pre-visualizacao neste cadastro.</span>
                </span>
                <input ref={coverInputRef} accept="image/*" className="sr-only" type="file" onChange={onCoverChange} />
              </button>
            </CardContent>
          </Card>

          <Card variant="section" className="border-hl-border shadow-hl-subtle">
            <CardContent className="space-y-5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-[color-mix(in_srgb,var(--hl-primary)_10%,var(--hl-surface))] text-hl-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold tracking-tight text-hl-text">O que sera criado</h2>
                  <p className="text-sm leading-5 text-hl-text-muted">
                    Um ponto unico para operar o ciclo tecnico do imovel.
                  </p>
                </div>
              </div>

              <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-bg-soft p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface text-hl-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-hl-text">{typeLabel}</p>
                    <p className="text-xs text-hl-text-muted">Perfil tecnico 360 em formacao</p>
                  </div>
                </div>
              </div>

              <ul className="space-y-3">
                {summaryItems.map((item) => (
                  <li key={item.label} className="flex items-center gap-3 text-sm text-hl-text">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                    <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-hl-success" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:hidden">
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Cadastrar imovel
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

type FormSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

function FormSection({ eyebrow, title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle sm:p-5">
      <div className="mb-5 flex flex-col gap-1 border-b border-hl-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-hl-primary">{eyebrow}</p>
        <h2 className="text-lg font-semibold tracking-tight text-hl-text">{title}</h2>
        <p className="max-w-2xl text-sm leading-5 text-hl-text-muted">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type FieldProps = {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  htmlFor: string;
  label: string;
};

function Field({ children, error, hint, htmlFor, label }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-hl-text">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs leading-5 text-hl-text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-hl-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

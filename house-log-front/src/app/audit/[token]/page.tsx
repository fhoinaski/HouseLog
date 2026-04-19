'use client';

import { use, useRef, useState } from 'react';
import { Building2, Camera, CheckCircle2, AlertCircle, Clock, X, Send } from 'lucide-react';
import { auditApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SYSTEM_TYPE_LABELS } from '@/lib/utils';

type AuditData = {
  token: string;
  order_title: string;
  order_description: string | null;
  system_type: string;
  before_photos: string[];
  property_name: string;
  address: string;
  scope: { canUploadPhotos: boolean; canUploadVideo: boolean; requiredFields: string[] };
  expires_at: string;
};

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'expired';

export default function AuditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const photoRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<AuditData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [nowTs] = useState(() => Date.now());

  // Fetch audit data on mount
  if (!initialized) {
    setInitialized(true);
    auditApi.getByToken(token)
      .then((d) => { setData(d); setState('ready'); })
      .catch((e: { message: string; code?: string }) => {
        if (e.message?.includes('expirou') || e.code === 'LINK_EXPIRED' || e.code === 'LINK_USED') {
          setState('expired');
          setErrorMsg(e.message);
        } else {
          setState('error');
          setErrorMsg(e.message || 'Link inválido');
        }
      });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPhotos = [...photos, ...files].slice(0, 10); // max 10
    setPhotos(newPhotos);
    const urls = newPhotos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    e.target.value = '';
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(previews[i]!);
    setPhotos(photos.filter((_, idx) => idx !== i));
    setPreviews(previews.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!data) return;
    setState('submitting');
    try {
      await auditApi.submit(token, photos, notes);
      setState('success');
    } catch (e) {
      setState('error');
      setErrorMsg((e as Error).message || 'Erro ao enviar');
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--hl-bg-page)">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-(--hl-text-secondary)">Carregando...</p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--hl-bg-page) p-4">
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--color-warning-light)">
            <Clock className="h-7 w-7 text-(--color-warning)" />
          </div>
          <h1 className="text-lg font-medium">Link expirado</h1>
          <p className="mt-2 text-sm text-(--hl-text-secondary)">{errorMsg}</p>
          <p className="mt-4 text-xs text-(--hl-text-tertiary)">
            Solicite um novo link ao responsável pelo imóvel.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--hl-bg-page) p-4">
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--color-danger-light)">
            <AlertCircle className="h-7 w-7 text-(--color-danger)" />
          </div>
          <h1 className="text-lg font-medium">Erro</h1>
          <p className="mt-2 text-sm text-(--hl-text-secondary)">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--hl-bg-page) p-4">
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--color-success-light)">
            <CheckCircle2 className="h-7 w-7 text-(--color-success)" />
          </div>
          <h1 className="text-lg font-medium">Enviado com sucesso!</h1>
          <p className="mt-2 text-sm text-(--hl-text-secondary)">
            Suas fotos e observações foram registradas. Obrigado!
          </p>
        </div>
      </div>
    );
  }

  // ── Ready state ────────────────────────────────────────────────────────────

  const scope = data?.scope;
  const hoursLeft = data
    ? Math.max(0, Math.ceil((new Date(data.expires_at).getTime() - nowTs) / 3600000))
    : 0;

  return (
    <div className="min-h-screen bg-(--hl-bg-page) pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 bg-(--hl-bg-card) px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary)">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-(--hl-text-primary)">{data?.property_name}</p>
          <p className="truncate text-xs text-(--hl-text-secondary)">{data?.address}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* OS Info */}
        <div className="rounded-xl border border-(--hl-border-light) bg-white p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-(--hl-text-tertiary)">
              {SYSTEM_TYPE_LABELS[data?.system_type ?? ''] ?? data?.system_type}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-(--color-warning)">
              <Clock className="h-3 w-3" /> {hoursLeft}h restantes
            </span>
          </div>
          <p className="font-medium text-(--hl-text-primary)">{data?.order_title}</p>
          {data?.order_description && (
            <p className="mt-1 line-clamp-3 text-sm text-(--hl-text-secondary)">{data.order_description}</p>
          )}
        </div>

        {/* Before photos (read-only reference) */}
        {data?.before_photos && data.before_photos.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-(--hl-text-tertiary)">
              Fotos de referência (antes)
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.before_photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="antes"
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        )}

        {/* Photo upload */}
        {scope?.canUploadPhotos && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-(--hl-text-tertiary)">
              Suas fotos (depois / execução)
            </p>

            {/* Preview grid */}
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {previews.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`foto-${i}`} className="h-24 w-full rounded-lg object-cover" />
                    <button
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center"
                      onClick={() => removePhoto(i)}
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => photoRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--hl-border-light) py-6 text-(--hl-text-tertiary) transition-colors hover:border-(--color-primary-border) hover:text-(--color-primary)"
            >
              <Camera className="h-6 w-6" />
              <span className="text-sm font-medium">
                {previews.length > 0 ? 'Adicionar mais fotos' : 'Tirar foto / escolher arquivo'}
              </span>
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.04em] text-(--hl-text-tertiary)">
            Observações
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Descreva o que foi realizado, materiais usados, observações..."
            className="w-full resize-none rounded-lg border border-(--hl-border-light) bg-white px-3 py-2 text-sm placeholder:text-(--hl-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-primary-border)"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          loading={state === 'submitting'}
          disabled={scope?.canUploadPhotos && photos.length === 0}
          className="h-12 w-full text-base"
        >
          <Send className="h-4 w-4" />
          {state === 'submitting' ? 'Enviando...' : 'Enviar Registro'}
        </Button>

        {scope?.canUploadPhotos && photos.length === 0 && (
          <p className="text-center text-xs text-(--hl-text-tertiary)">
            Adicione pelo menos 1 foto para enviar
          </p>
        )}
      </div>
    </div>
  );
}

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
          setErrorMsg(e.message || 'Link invalido');
        }
      });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPhotos = [...photos, ...files].slice(0, 10);
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

  if (state === 'loading') {
    return (
      <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border-focus border-t-transparent" />
          <p className="mt-4 text-sm text-text-secondary">Carregando...</p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page p-4">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-warning">
            <Clock className="h-7 w-7 text-text-warning" />
          </div>
          <h1 className="text-lg font-medium text-text-primary">Link expirado</h1>
          <p className="mt-2 text-sm text-text-secondary">{errorMsg}</p>
          <p className="mt-4 text-xs text-text-tertiary">Solicite um novo link ao responsavel pelo imovel.</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page p-4">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-danger">
            <AlertCircle className="h-7 w-7 text-text-danger" />
          </div>
          <h1 className="text-lg font-medium text-text-primary">Erro</h1>
          <p className="mt-2 text-sm text-text-secondary">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page p-4">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-success">
            <CheckCircle2 className="h-7 w-7 text-text-success" />
          </div>
          <h1 className="text-lg font-medium text-text-primary">Enviado com sucesso!</h1>
          <p className="mt-2 text-sm text-text-secondary">Suas fotos e observacoes foram registradas. Obrigado!</p>
        </div>
      </div>
    );
  }

  const scope = data?.scope;
  const hoursLeft = data ? Math.max(0, Math.ceil((new Date(data.expires_at).getTime() - nowTs) / 3600000)) : 0;

  return (
    <div className="safe-top safe-bottom min-h-screen bg-bg-page">
      <div className="flex items-center gap-3 bg-bg-surface px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-accent">
          <Building2 className="h-4 w-4 text-text-on-accent" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{data?.property_name}</p>
          <p className="truncate text-xs text-text-secondary">{data?.address}</p>
        </div>
      </div>

      <div className="tap-highlight-none mx-auto max-w-lg space-y-5 px-4 py-6">
        <div className="hl-card">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-text-tertiary">
              {SYSTEM_TYPE_LABELS[data?.system_type ?? ''] ?? data?.system_type}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-text-warning">
              <Clock className="h-3 w-3" /> {hoursLeft}h restantes
            </span>
          </div>
          <p className="font-medium text-text-primary">{data?.order_title}</p>
          {data?.order_description && (
            <p className="mt-1 line-clamp-3 text-sm text-text-secondary">{data.order_description}</p>
          )}
        </div>

        {data?.before_photos && data.before_photos.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-text-tertiary">Fotos de referencia (antes)</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.before_photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="antes" className="h-20 w-20 rounded-lg object-cover" />
              ))}
            </div>
          </div>
        )}

        {scope?.canUploadPhotos && (
          <div>
            <p className="mb-2 text-xs font-medium text-text-tertiary">Suas fotos (depois / execucao)</p>

            {previews.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {previews.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`foto-${i}`} className="h-24 w-full rounded-lg object-cover" />
                    <button
                      className="hl-btn-ghost absolute right-1 top-1 h-input-md w-input-md rounded-full bg-bg-brand p-0"
                      onClick={() => removePhoto(i)}
                      aria-label="Remover foto"
                    >
                      <X className="h-3 w-3 text-text-inverse" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => photoRef.current?.click()}
              className="hl-btn-ghost flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-subtle py-6 text-text-tertiary hover:border-border-accent hover:text-text-accent"
              aria-label="Selecionar fotos"
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
              className="hl-input sr-only"
              onChange={handlePhotoSelect}
            />
          </div>
        )}

        <div>
          <label htmlFor="audit-notes" className="hl-label mb-2 text-text-tertiary">Observacoes</label>
          <textarea
            id="audit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Descreva o que foi realizado, materiais usados e observacoes..."
            className="hl-textarea resize-none"
          />
        </div>

        <Button onClick={handleSubmit} loading={state === 'submitting'} disabled={scope?.canUploadPhotos && photos.length === 0} className="h-12 w-full text-base">
          <Send className="h-4 w-4" />
          {state === 'submitting' ? 'Enviando...' : 'Enviar registro'}
        </Button>

        {scope?.canUploadPhotos && photos.length === 0 && (
          <p className="text-center text-xs text-text-tertiary">Adicione pelo menos 1 foto para enviar</p>
        )}
      </div>
    </div>
  );
}

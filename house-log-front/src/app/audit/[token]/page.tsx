'use client';

import { use, useRef, useState } from 'react';
import { Building2, Camera, Upload, CheckCircle2, AlertCircle, Clock, X, Send } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-xs">
          <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-lg font-bold">Link Expirado</h1>
          <p className="text-sm text-slate-500 mt-2">{errorMsg}</p>
          <p className="text-xs text-slate-400 mt-4">
            Solicite um novo link ao responsável pelo imóvel.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-xs">
          <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-rose-500" />
          </div>
          <h1 className="text-lg font-bold">Erro</h1>
          <p className="text-sm text-slate-500 mt-2">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-xs">
          <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <h1 className="text-lg font-bold">Enviado com sucesso!</h1>
          <p className="text-sm text-slate-500 mt-2">
            Suas fotos e observações foram registradas. Obrigado!
          </p>
        </div>
      </div>
    );
  }

  // ── Ready state ────────────────────────────────────────────────────────────

  const scope = data?.scope;
  const hoursLeft = data
    ? Math.max(0, Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / 3600000))
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 px-4 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{data?.property_name}</p>
          <p className="text-slate-400 text-xs truncate">{data?.address}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* OS Info */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              {SYSTEM_TYPE_LABELS[data?.system_type ?? ''] ?? data?.system_type}
            </span>
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" /> {hoursLeft}h restantes
            </span>
          </div>
          <p className="font-semibold text-slate-900">{data?.order_title}</p>
          {data?.order_description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-3">{data.order_description}</p>
          )}
        </div>

        {/* Before photos (read-only reference) */}
        {data?.before_photos && data.before_photos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Fotos de referência (antes)
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.before_photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="antes"
                  className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        )}

        {/* Photo upload */}
        {scope?.canUploadPhotos && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
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
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-slate-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
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
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
            Observações
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Descreva o que foi realizado, materiais usados, observações..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          loading={state === 'submitting'}
          disabled={scope?.canUploadPhotos && photos.length === 0}
          className="w-full h-12 text-base"
        >
          <Send className="h-4 w-4" />
          {state === 'submitting' ? 'Enviando...' : 'Enviar Registro'}
        </Button>

        {scope?.canUploadPhotos && photos.length === 0 && (
          <p className="text-center text-xs text-slate-400">
            Adicione pelo menos 1 foto para enviar
          </p>
        )}
      </div>
    </div>
  );
}

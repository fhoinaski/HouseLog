'use client';

import { use, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText, Upload, Trash2, ExternalLink, Sparkles,
  FileSearch, Filter,
} from 'lucide-react';
import { documentsApi, type Document } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Nota fiscal', manual: 'Manual', project: 'Projeto',
  contract: 'Contrato', deed: 'Escritura', permit: 'Licença/Alvará',
  insurance: 'Seguro', other: 'Outro',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  invoice: 'bg-bg-warning text-text-warning',
  manual: 'bg-bg-subtle text-text-secondary',
  project: 'bg-bg-accent-subtle text-text-accent',
  contract: 'bg-bg-accent-subtle text-text-accent',
  deed: 'bg-bg-success text-text-success',
  permit: 'bg-bg-warning text-text-warning',
  insurance: 'bg-bg-danger text-text-danger',
  other: 'bg-bg-subtle text-text-secondary',
};

const metaSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1, 'Título obrigatório'),
  vendor_cnpj: z.string().optional(),
  amount: z.coerce.number().positive().optional().or(z.literal('')),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
});

type MetaForm = z.infer<typeof metaSchema>;

function DocRow({
  doc, onDelete, onOcr, ocrLoading,
}: {
  doc: Document;
  onDelete: () => void;
  onOcr: () => void;
  ocrLoading: boolean;
}) {
  const hasOcr = !!doc.ocr_data;
  const isInvoice = doc.type === 'invoice';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', DOC_TYPE_COLORS[doc.type])}>
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-text-primary truncate">{doc.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</Badge>
              {doc.issue_date && (
                <span className="text-xs text-text-secondary">{formatDate(doc.issue_date)}</span>
              )}
              {doc.amount && (
                <span className="text-xs font-medium text-text-success">{formatCurrency(doc.amount)}</span>
              )}
              {doc.expiry_date && new Date(doc.expiry_date) < new Date() && (
                <Badge variant="destructive" className="text-xs">Vencido</Badge>
              )}
            </div>
            {doc.vendor_cnpj && (
              <p className="text-xs text-text-secondary mt-0.5">CNPJ: {doc.vendor_cnpj}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isInvoice && !hasOcr && (
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-text-accent hover:bg-bg-accent-subtle"
                title="Processar com IA"
                onClick={onOcr}
                disabled={ocrLoading}
              >
                <Sparkles className={cn('h-3.5 w-3.5', ocrLoading && 'animate-pulse')} />
              </Button>
            )}
            {hasOcr && (
              <span title="OCR processado">
                <Sparkles className="h-3.5 w-3.5 text-text-accent" />
              </span>
            )}
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-bg-subtle transition-colors"
              aria-label="Abrir documento"
            >
              <ExternalLink className="h-3.5 w-3.5 text-text-secondary" />
            </a>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-text-danger hover:bg-bg-danger"
              onClick={onDelete}
              aria-label="Remover documento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mutate: globalMutate } = useSWRConfig();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);

  const { data, mutate } = useSWR(
    ['documents', id, typeFilter],
    () => documentsApi.list(id, { type: typeFilter === 'all' ? undefined : typeFilter })
  );

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<MetaForm>({
    resolver: zodResolver(metaSchema),
    defaultValues: { type: 'invoice' },
  });

  const watchType = watch('type');
  const docs = data?.data ?? [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    reset((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, '') }));
    setDialogOpen(true);
  }

  async function onSubmit(form: MetaForm) {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await documentsApi.upload(id, uploadFile, {
        ...form,
        amount: form.amount === '' ? undefined : Number(form.amount),
      });
      await mutate();
      void globalMutate(['dashboard', id]);
      toast.success('Documento enviado');
      setDialogOpen(false);
      setUploadFile(null);
      reset();
    } catch (e) {
      toast.error('Erro ao enviar', { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    try {
      await documentsApi.delete(id, docId);
      await mutate();
      toast.success('Documento removido');
    } catch (e) {
      toast.error('Erro ao remover', { description: (e as Error).message });
    }
  }

  async function handleOcr(docId: string) {
    setOcrLoading(docId);
    try {
      const result = await documentsApi.ocr(id, docId);
      await mutate();
      toast.success('OCR concluído', {
        description: result.ocr_data?.vendor_name
          ? `Fornecedor: ${String(result.ocr_data.vendor_name)}`
          : 'Dados extraídos com sucesso',
      });
    } catch (e) {
      toast.error('Erro no OCR', { description: (e as Error).message });
    } finally {
      setOcrLoading(null);
    }
  }

  return (
    <div className="space-y-5 safe-bottom">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-text-primary">Documentos</h2>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Enviar arquivo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileSearch className="mb-3 h-10 w-10 text-text-disabled" />
          <p className="text-text-secondary text-sm">
            {typeFilter ? 'Nenhum documento deste tipo' : 'Nenhum documento enviado'}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Enviar documento
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              onDelete={() => handleDelete(doc.id)}
              onOcr={() => handleOcr(doc.id)}
              ocrLoading={ocrLoading === doc.id}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setUploadFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do documento</DialogTitle>
          </DialogHeader>
          {uploadFile && (
            <div className="rounded-lg bg-bg-subtle px-3 py-2 text-sm text-text-secondary mb-2">
              📄 {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select defaultValue="invoice" onValueChange={(v) => setValue('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-text-danger">{errors.type.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-title">Título *</Label>
                <Input id="doc-title" {...register('title')} />
                {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
              </div>

              {watchType === 'invoice' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-cnpj">CNPJ fornecedor</Label>
                    <Input id="doc-cnpj" placeholder="00.000.000/0001-00" {...register('vendor_cnpj')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-amount">Valor (R$)</Label>
                    <Input id="doc-amount" type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="doc-issue">Data de emissão</Label>
                <Input id="doc-issue" type="date" {...register('issue_date')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-expiry">Validade</Label>
                <Input id="doc-expiry" type="date" {...register('expiry_date')} />
              </div>
            </div>

            {watchType === 'invoice' && (
              <div className="flex items-center gap-2 rounded-lg border-half border-border-accent bg-bg-accent-subtle px-3 py-2 text-xs text-text-accent">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Após enviar, use o botão IA para extrair dados automaticamente da nota fiscal.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setUploadFile(null); }} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={uploading} className="flex-1">
                <Upload className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

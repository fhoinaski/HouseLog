'use client';

import type * as React from 'react';
import { use, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExternalLink, FileSearch, FileText, Filter, Sparkles, Trash2, Upload } from 'lucide-react';
import { documentsApi, type Document } from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { documentRowVariants, documentTypeIconVariants } from '@/components/ui/visual-system';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Nota fiscal',
  manual: 'Manual',
  project: 'Projeto',
  contract: 'Contrato',
  deed: 'Escritura',
  permit: 'Licença/Alvará',
  insurance: 'Seguro',
  other: 'Outro',
};

const DOC_TYPE_TONES: Record<string, 'default' | 'accent' | 'warning' | 'success' | 'danger'> = {
  invoice: 'warning',
  manual: 'default',
  project: 'accent',
  contract: 'accent',
  deed: 'success',
  permit: 'warning',
  insurance: 'danger',
  other: 'default',
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
  doc,
  onDelete,
  onOcr,
  ocrLoading,
}: {
  doc: Document;
  onDelete: () => void;
  onOcr: () => void;
  ocrLoading: boolean;
}) {
  const hasOcr = Boolean(doc.ocr_data);
  const isInvoice = doc.type === 'invoice';
  const expired = Boolean(doc.expiry_date && new Date(doc.expiry_date) < new Date());
  const tone = DOC_TYPE_TONES[doc.type] ?? 'default';

  return (
    <article className={documentRowVariants()}>
      <div className="flex items-start gap-3">
        <div className={documentTypeIconVariants({ tone })}>
          <FileText className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{doc.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {DOC_TYPE_LABELS[doc.type] ?? doc.type}
            </Badge>
            {doc.issue_date && <span className="text-xs text-text-secondary">{formatDate(doc.issue_date)}</span>}
            {doc.amount && <span className="text-xs font-medium text-text-success">{formatCurrency(doc.amount)}</span>}
            {expired && (
              <Badge variant="destructive" className="text-xs">
                Vencido
              </Badge>
            )}
            {hasOcr && (
              <Badge variant="outline" className="text-xs">
                OCR processado
              </Badge>
            )}
          </div>
          {doc.vendor_cnpj && <p className="mt-1 text-xs text-text-secondary">CNPJ: {doc.vendor_cnpj}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isInvoice && !hasOcr && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 min-h-8 w-8 text-text-accent hover:bg-bg-accent-subtle"
              title="Processar com IA"
              onClick={onOcr}
              disabled={ocrLoading}
            >
              <Sparkles className={cn('h-3.5 w-3.5', ocrLoading && 'animate-pulse')} />
            </Button>
          )}
          {hasOcr && (
            <span title="OCR processado" className="flex h-8 w-8 items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-text-accent" />
            </span>
          )}
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-text-secondary transition-colors hover:bg-bg-subtle"
            aria-label="Abrir documento"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 min-h-8 w-8 text-text-danger hover:bg-bg-danger"
            onClick={onDelete}
            aria-label="Remover documento"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mutate: globalMutate } = useSWRConfig();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState<string | null>(null);

  const { data, mutate, isLoading } = useSWR(['documents', id, typeFilter], () =>
    documentsApi.list(id, { type: typeFilter === 'all' ? undefined : typeFilter })
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MetaForm>({
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await documentsApi.delete(id, deleteTarget.id);
      await mutate();
      toast.success('Documento removido');
    } catch (e) {
      toast.error('Erro ao remover', { description: (e as Error).message });
    } finally {
      setDeleteTarget(null);
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
    <div className="safe-bottom space-y-6">
      <PageHeader
        density="editorial"
        eyebrow="Acervo técnico"
        title="Documentos do imóvel"
        description="Repositório documental do prontuário técnico: notas, manuais, contratos, projetos, seguros e licenças."
        actions={
          <>
            <Button type="button" onClick={() => fileRef.current?.click()}>
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
          </>
        }
      />

      <PageSection
        title="Governança documental"
        description="Filtre o acervo para localizar evidências técnicas, comprovantes fiscais e documentos com validade operacional."
        tone="strong"
        density="editorial"
        actions={
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="h-6 w-6" />}
            title={typeFilter === 'all' ? 'Nenhum documento no acervo' : 'Nenhum documento neste filtro'}
            description={
              typeFilter === 'all'
                ? 'Envie notas, manuais, projetos e comprovantes para compor o prontuário técnico do imóvel.'
                : 'Ajuste o filtro ou envie um novo documento para este tipo de registro.'
            }
            tone="subtle"
            density="spacious"
            actions={
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Enviar documento
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onDelete={() => setDeleteTarget(doc)}
                onOcr={() => handleOcr(doc.id)}
                ocrLoading={ocrLoading === doc.id}
              />
            ))}
          </div>
        )}
      </PageSection>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setUploadFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do documento</DialogTitle>
          </DialogHeader>
          {uploadFile && (
            <div className="mb-2 rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2 text-sm text-text-secondary">
              {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-1 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select defaultValue="invoice" onValueChange={(value) => setValue('type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
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
              <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border-half border-border-accent bg-bg-accent-subtle px-3 py-2 text-xs text-text-accent">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Após enviar, use o botão IA para extrair dados automaticamente da nota fiscal.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setUploadFile(null);
                }}
                className="flex-1"
              >
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-6 text-text-secondary">
              Tem certeza que deseja remover este documento do acervo técnico? Esta ação não pode ser desfeita.
            </p>
            {deleteTarget && (
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2 text-sm">
                <p className="truncate font-medium text-text-primary">{deleteTarget.title}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {DOC_TYPE_LABELS[deleteTarget.type] ?? deleteTarget.type}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} className="flex-1">
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

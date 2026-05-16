'use client';

import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  LineChart,
  Plus,
  RefreshCw,
  Ruler,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricCard } from '@/components/ui/metric-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { expensesApi, propertiesApi } from '@/lib/api';
import { cn, EXPENSE_CATEGORY_LABELS, formatCurrency, formatMonth } from '@/lib/utils';
import type { DreDataPoint, CategoryDataPoint } from '@/components/financial/financial-charts';

/**
 * Recharts (~140 KB) é carregado via dynamic import para não bloquear
 * o parse inicial da página — em mobile Android o parse JS é 3-5× mais lento.
 * O fallback (skeleton) mantém o layout estável enquanto o bundle carrega.
 */
const FinancialCharts = dynamic(
  () => import('@/components/financial/financial-charts').then((m) => ({ default: m.FinancialCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="animate-skeleton h-[280px] w-full rounded-[var(--radius-xl)]" />
        <div className="animate-skeleton h-[240px] w-full rounded-[var(--radius-xl)]" />
      </div>
    ),
  }
);

const CHART_COLORS = [
  'var(--interactive-primary-bg)',
  'var(--text-warning)',
  'var(--text-success)',
  'var(--text-danger)',
  'var(--text-secondary)',
  'var(--text-tertiary)',
  'var(--border-accent)',
  'var(--border-warning)',
];

const ALL_CATEGORIES = {
  ...EXPENSE_CATEGORY_LABELS,
  rent: 'Aluguel',
  service: 'Serviços',
} as Record<string, string>;

const expenseSchema = z.object({
  type: z.enum(['expense', 'revenue']).default('expense'),
  category: z.string().min(1, 'Categoria obrigatoria'),
  amount: z.coerce.number().positive('Valor obrigatorio'),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export default function FinancialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'revenue'>('expense');
  const [nowTs] = useState(() => Date.now());

  const currentMonth = new Date(nowTs).toISOString().slice(0, 7);
  const sixMonthsAgo = new Date(nowTs - 6 * 30 * 86400000).toISOString().slice(0, 7);

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR(['expenses-summary', id], () => expensesApi.summary(id, { from: sixMonthsAgo, to: currentMonth }));

  const { data: propData } = useSWR(['property', id], () => propertiesApi.get(id));
  const area = propData?.property?.area_m2 ?? null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { reference_month: currentMonth, type: 'expense', is_recurring: false },
  });

  const watchIsRecurring = useWatch({ control, name: 'is_recurring' });
  const watchType = useWatch({ control, name: 'type' });

  function openDialog(type: 'expense' | 'revenue') {
    setFormType(type);
    setValue('type', type);
    setDialogOpen(true);
  }

  async function onSubmit(form: ExpenseForm) {
    try {
      const res = await expensesApi.create(id, {
        ...form,
        is_recurring: form.is_recurring ? 1 : 0,
      } as Parameters<typeof expensesApi.create>[1]);
      await mutate();
      reset({ reference_month: currentMonth, type: 'expense', is_recurring: false });
      setDialogOpen(false);
      const generated = (res as { generated?: number }).generated ?? 1;
      toast.success(
        generated > 1
          ? `${generated} lancamentos criados com recorrencia anual`
          : 'Lancamento criado'
      );
    } catch (submitError) {
      toast.error('Erro ao salvar lancamento', { description: (submitError as Error).message });
    }
  }

  const expenseByMonth = new Map((data?.by_month ?? []).map((m) => [m.reference_month, m.total]));
  const revenueByMonth = new Map((data?.by_month_revenue ?? []).map((m) => [m.reference_month, m.total]));

  const allMonths = Array.from(new Set([...expenseByMonth.keys(), ...revenueByMonth.keys()])).sort();

  const dreData: DreDataPoint[] = allMonths.map((m) => ({
    month: formatMonth(m),
    despesas: expenseByMonth.get(m) ?? 0,
    receitas: revenueByMonth.get(m) ?? 0,
    saldo: (revenueByMonth.get(m) ?? 0) - (expenseByMonth.get(m) ?? 0),
  }));

  const totalExpenses = data?.total ?? 0;
  const totalRevenue = data?.total_revenue ?? 0;
  const balance = totalRevenue - totalExpenses;
  const costPerSqm = area && area > 0 ? totalExpenses / area : null;

  const categoryData: CategoryDataPoint[] = (data?.by_category ?? []).map((category, index) => ({
    name: ALL_CATEGORIES[category.category] ?? category.category,
    value: category.total,
    color: CHART_COLORS[index % CHART_COLORS.length] ?? 'var(--text-secondary)',
  }));

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="compact"
        eyebrow="Governança financeira"
        title="Saúde financeira"
        actions={
          <>
            <Button variant="outline" onClick={() => openDialog('revenue')}>
              <TrendingUp className="h-4 w-4" />
              Receita
            </Button>
            <Button onClick={() => openDialog('expense')}>
              <Plus className="h-4 w-4" />
              Despesa
            </Button>
          </>
        }
      />

      {error ? (
        <EmptyState
          tone="strong"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Não foi possível carregar o resumo financeiro."
          description="Verifique a conexao e tente novamente antes de registrar novas analises."
          actions={<Button variant="outline" onClick={() => void mutate()}>Tentar novamente</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              tone="danger"
              icon={TrendingDown}
              label="Despesas nos ultimos 6 meses"
              value={isLoading ? '...' : formatCurrency(totalExpenses)}
              valueClassName="text-text-danger"
            />
            <MetricCard
              tone="success"
              icon={TrendingUp}
              label="Receitas nos ultimos 6 meses"
              value={isLoading ? '...' : formatCurrency(totalRevenue)}
              valueClassName="text-text-success"
            />
            <MetricCard
              tone={balance >= 0 ? 'success' : 'danger'}
              icon={LineChart}
              label="Saldo do periodo"
              value={isLoading ? '...' : formatCurrency(balance)}
              valueClassName={cn(balance >= 0 ? 'text-text-success' : 'text-text-danger')}
            />
            <MetricCard
              tone="accent"
              icon={Ruler}
              label={area ? `Base: ${area} m²` : 'Área não informada'}
              value={isLoading ? '...' : costPerSqm != null ? formatCurrency(costPerSqm) : '-'}
              helper="Custo operacional por metro quadrado."
            />
          </div>

          {/* Charts — lazy loaded via dynamic() para não bloquear o parse inicial em mobile */}
          <FinancialCharts
            dreData={dreData}
            categoryData={categoryData}
            onAddExpense={() => openDialog('expense')}
          />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formType === 'revenue' ? (
                <>
                  <TrendingUp className="h-4 w-4 text-text-success" />
                  Nova receita
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-text-danger" />
                  Nova despesa
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select onValueChange={(value) => setValue('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ALL_CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-text-danger">{errors.category.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0,00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-text-danger">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-month">Mes de referencia *</Label>
                <Input id="ref-month" type="month" {...register('reference_month')} />
                {errors.reference_month && <p className="text-xs text-text-danger">{errors.reference_month.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observacoes</Label>
              <Input id="notes" placeholder="Opcional" {...register('notes')} />
            </div>

            {watchType === 'expense' && (
              <label className="flex cursor-pointer select-none items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3">
                <span className="relative">
                  <input type="checkbox" className="peer sr-only" {...register('is_recurring')} />
                  <span className="block h-5 w-9 rounded-full bg-border-subtle transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-interactive-primary-bg peer-checked:after:translate-x-4" />
                </span>
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                    <RefreshCw className="h-3.5 w-3.5 text-text-accent" />
                    Fixa mensal
                  </span>
                  <span className="block text-xs leading-5 text-text-secondary">
                    {watchIsRecurring
                      ? 'Gera 12 lancamentos a partir deste mes.'
                      : 'Ative para criar recorrencia anual.'}
                  </span>
                </span>
              </label>
            )}

            {watchIsRecurring && (
              <div className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-bg-accent-subtle px-3 py-2 text-xs leading-5 text-text-accent">
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                Serao criados automaticamente 12 lancamentos mensais.
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

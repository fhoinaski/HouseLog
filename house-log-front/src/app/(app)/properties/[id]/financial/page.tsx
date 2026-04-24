'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  BarChart3,
  LineChart,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Ruler,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricCard } from '@/components/ui/metric-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { expensesApi, propertiesApi } from '@/lib/api';
import { cn, EXPENSE_CATEGORY_LABELS, formatCurrency, formatMonth } from '@/lib/utils';

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

const tooltipStyle = {
  borderRadius: '12px',
  border: '0',
  background: 'var(--surface-raised)',
  boxShadow: 'var(--surface-shadow-raised)',
  color: 'var(--text-primary)',
  fontSize: '12px',
};

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

  const dreData = allMonths.map((m) => ({
    month: formatMonth(m),
    despesas: expenseByMonth.get(m) ?? 0,
    receitas: revenueByMonth.get(m) ?? 0,
    saldo: (revenueByMonth.get(m) ?? 0) - (expenseByMonth.get(m) ?? 0),
  }));

  const totalExpenses = data?.total ?? 0;
  const totalRevenue = data?.total_revenue ?? 0;
  const balance = totalRevenue - totalExpenses;
  const costPerSqm = area && area > 0 ? totalExpenses / area : null;

  const categoryData = (data?.by_category ?? []).map((category, index) => ({
    name: ALL_CATEGORIES[category.category] ?? category.category,
    value: category.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
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

          <PageSection
            tone="surface"
            density="compact"
            title="Resultado operacional"
          >
            {dreData.length === 0 ? (
              <EmptyState
                tone="strong"
                icon={<BarChart3 className="h-5 w-5" />}
                title="Sem lancamentos no periodo."
                description="Registre receitas ou despesas para formar o historico financeiro deste imovel."
                actions={<Button onClick={() => openDialog('expense')}>Adicionar lancamento</Button>}
              />
            ) : (
              <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3 sm:p-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dreData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `R$${(Number(v) / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === 'despesas' ? 'Despesas' : name === 'receitas' ? 'Receitas' : 'Saldo',
                        ]}
                        contentStyle={tooltipStyle}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span className="text-xs capitalize text-text-secondary">{value}</span>}
                      />
                      <Bar dataKey="despesas" fill="var(--text-danger)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="receitas" fill="var(--text-success)" radius={[6, 6, 0, 0]} />
                      <Line dataKey="saldo" stroke="var(--interactive-primary-bg)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </PageSection>

          <PageSection
            tone="surface"
            density="compact"
            title="Composição de despesas"
          >
            {categoryData.length === 0 ? (
              <EmptyState
                tone="strong"
                density="compact"
                icon={<PieChartIcon className="h-5 w-5" />}
                title="Ainda nao ha despesas categorizadas."
                description="As categorias aparecem aqui conforme os lancamentos forem registrados."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
                <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3 sm:p-4">
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={88}
                          innerRadius={48}
                        >
                          {categoryData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [formatCurrency(value)]} contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-2">
                  {categoryData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-strong)] px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                        <span className="truncate text-sm text-text-secondary">{entry.name}</span>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-text-primary">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </PageSection>
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

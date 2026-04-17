'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Plus, TrendingUp, TrendingDown, RefreshCw, ShieldCheck, Ruler } from 'lucide-react';
import { expensesApi, propertiesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency, formatMonth, EXPENSE_CATEGORY_LABELS, cn } from '@/lib/utils';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#64748b', '#06b6d4', '#ec4899'];

const ALL_CATEGORIES = {
  ...EXPENSE_CATEGORY_LABELS,
  rent: 'Aluguel',
  service: 'Serviços',
} as Record<string, string>;

const expenseSchema = z.object({
  type: z.enum(['expense', 'revenue']).default('expense'),
  category: z.string().min(1),
  amount: z.coerce.number().positive('Valor obrigatório'),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export default function FinancialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'revenue'>('expense');

  const currentMonth = new Date().toISOString().slice(0, 7);
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 86400000).toISOString().slice(0, 7);

  const { data, mutate } = useSWR(
    ['expenses-summary', id],
    () => expensesApi.summary(id, { from: sixMonthsAgo, to: currentMonth })
  );

  const { data: propData } = useSWR(['property', id], () => propertiesApi.get(id));
  const area = propData?.property?.area_m2 ?? null;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { reference_month: currentMonth, type: 'expense', is_recurring: false },
  });

  const watchIsRecurring = watch('is_recurring');
  const watchType = watch('type');

  function openDialog(type: 'expense' | 'revenue') {
    setFormType(type);
    setValue('type', type);
    setDialogOpen(true);
  }

  async function onSubmit(form: ExpenseForm) {
    try {
      const res = await expensesApi.create(id, { ...form, is_recurring: form.is_recurring ? 1 : 0 } as Parameters<typeof expensesApi.create>[1]);
      await mutate();
      reset({ reference_month: currentMonth, type: 'expense', is_recurring: false });
      setDialogOpen(false);
      const generated = (res as { generated?: number }).generated ?? 1;
      toast.success(
        generated > 1
          ? `${generated} lançamentos criados (recorrência 12 meses)`
          : 'Lançamento criado'
      );
    } catch (e) {
      toast.error('Erro ao salvar', { description: (e as Error).message });
    }
  }

  // DRE chart data: merge expense and revenue by month
  const expenseByMonth = new Map((data?.by_month ?? []).map((m) => [m.reference_month, m.total]));
  const revenueByMonth = new Map(
    ((data as { by_month_revenue?: { reference_month: string; total: number }[] })?.by_month_revenue ?? [])
      .map((m) => [m.reference_month, m.total])
  );

  const allMonths = Array.from(
    new Set([...expenseByMonth.keys(), ...revenueByMonth.keys()])
  ).sort();

  const dreData = allMonths.map((m) => ({
    month: formatMonth(m),
    despesas: expenseByMonth.get(m) ?? 0,
    receitas: revenueByMonth.get(m) ?? 0,
    saldo: (revenueByMonth.get(m) ?? 0) - (expenseByMonth.get(m) ?? 0),
  }));

  const totalExpenses = data?.total ?? 0;
  const totalRevenue = (data as { total_revenue?: number })?.total_revenue ?? 0;
  const balance = totalRevenue - totalExpenses;
  const costPerSqm = area && area > 0 ? totalExpenses / area : null;

  const categoryData = (data?.by_category ?? []).map((c, i) => ({
    name: ALL_CATEGORIES[c.category] ?? c.category,
    value: c.total,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Saúde Financeira</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Últimos 6 meses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openDialog('revenue')}>
            <TrendingUp className="h-4 w-4" />
            Receita
          </Button>
          <Button onClick={() => openDialog('expense')}>
            <Plus className="h-4 w-4" />
            Despesa
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Despesas</p>
            <p className="text-2xl font-bold text-rose-500 mt-1">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-[var(--muted-foreground)]">6 meses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Receitas</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-[var(--muted-foreground)]">6 meses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Saldo</p>
            <p className={cn('text-2xl font-bold mt-1', balance >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
              {formatCurrency(balance)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">período</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-2">
              <Ruler className="h-4 w-4 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Custo/m²</p>
                <p className="text-2xl font-bold mt-1">
                  {costPerSqm != null ? formatCurrency(costPerSqm) : '—'}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {area ? `${area} m²` : 'área não informada'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DRE Chart — Receitas vs Despesas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary-600" />
            DRE — Receitas vs Despesas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {dreData.length === 0 ? (
            <p className="text-sm text-center py-8 text-[var(--muted-foreground)]">Nenhum dado ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dreData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    formatCurrency(v),
                    name === 'despesas' ? 'Despesas' : name === 'receitas' ? 'Receitas' : 'Saldo',
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
                <Bar dataKey="despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Line dataKey="saldo" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Pie chart — by category */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v)]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expense/Revenue dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formType === 'revenue'
                ? <><TrendingUp className="h-4 w-4 text-emerald-600" />Nova Receita</>
                : <><TrendingDown className="h-4 w-4 text-rose-500" />Nova Despesa</>
              }
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select onValueChange={(v) => setValue('category', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ALL_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-rose-500">{errors.category.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0,00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-rose-500">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-month">Mês de referência *</Label>
                <Input id="ref-month" type="month" {...register('reference_month')} />
                {errors.reference_month && <p className="text-xs text-rose-500">{errors.reference_month.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Input id="notes" placeholder="Opcional..." {...register('notes')} />
            </div>

            {/* Recurring toggle (expenses only) */}
            {watchType === 'expense' && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    {...register('is_recurring')}
                  />
                  <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-4" />
                </div>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-primary-600" />
                    Fixa mensal
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {watchIsRecurring
                      ? 'Gera 12 lançamentos a partir deste mês'
                      : 'Ativar para criar recorrência anual'}
                  </p>
                </div>
              </label>
            )}

            {watchIsRecurring && (
              <div className="rounded-lg bg-primary-50 border border-primary-200 px-3 py-2 text-xs text-primary-700 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />
                Serão criados automaticamente 12 lançamentos mensais.
              </div>
            )}

            <div className="flex gap-3 pt-2">
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

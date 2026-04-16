'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Plus, TrendingUp } from 'lucide-react';
import { expensesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatMonth, EXPENSE_CATEGORY_LABELS } from '@/lib/utils';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#64748b', '#06b6d4', '#ec4899'];

const expenseSchema = z.object({
  category: z.string().min(1),
  amount: z.coerce.number().positive('Valor obrigatório'),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
  notes: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export default function FinancialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 86400000).toISOString().slice(0, 7);

  const { data, mutate } = useSWR(
    ['expenses-summary', id],
    () => expensesApi.summary(id, { from: sixMonthsAgo, to: currentMonth })
  );

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { reference_month: currentMonth },
  });

  async function onSubmit(form: ExpenseForm) {
    setError(null);
    try {
      await expensesApi.create(id, form);
      await mutate();
      reset({ reference_month: currentMonth });
      setDialogOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Prepare chart data
  const monthlyData = (data?.by_month ?? []).map((m) => ({
    month: formatMonth(m.reference_month),
    total: m.total,
  }));

  const categoryData = (data?.by_category ?? []).map((c) => ({
    name: EXPENSE_CATEGORY_LABELS[c.category] ?? c.category,
    value: c.total,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dashboard Financeiro</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Últimos 6 meses</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Total 6 meses</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency(data?.total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Maior categoria</p>
            <p className="text-2xl font-bold mt-1">
              {categoryData[0]
                ? EXPENSE_CATEGORY_LABELS[data?.by_category[0]?.category ?? ''] ?? '—'
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart — monthly */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary-600" />
            Despesas por Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {monthlyData.length === 0 ? (
            <p className="text-sm text-center py-8 text-[var(--muted-foreground)]">Nenhum dado ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Total']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Pie chart — by category */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Categoria</CardTitle>
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
                    {categoryData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
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

      {/* Expense dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select onValueChange={(v) => setValue('category', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
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

            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                {error}
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

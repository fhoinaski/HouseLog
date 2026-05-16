'use client';

/**
 * FinancialCharts — componente isolado para lazy-load do Recharts.
 *
 * Recharts pesa ~140 KB minificado. Este arquivo encapsula todos os
 * imports da biblioteca para que o Next.js dynamic() possa dividir
 * o bundle e carregar os charts apenas quando a seção for visível,
 * reduzindo o tempo de parse na financial page em mobile.
 *
 * Uso:
 *   const FinancialCharts = dynamic(
 *     () => import('@/components/financial/financial-charts'),
 *     { ssr: false, loading: () => <ChartSkeleton /> }
 *   );
 */

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
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { PageSection } from '@/components/layout/page-section';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export type DreDataPoint = {
  month: string;
  despesas: number;
  receitas: number;
  saldo: number;
};

export type CategoryDataPoint = {
  name: string;
  value: number;
  color: string;
};

type FinancialChartsProps = {
  dreData: DreDataPoint[];
  categoryData: CategoryDataPoint[];
  onAddExpense: () => void;
};

const tooltipStyle: React.CSSProperties = {
  borderRadius: '12px',
  border: '0',
  background: 'var(--surface-raised)',
  boxShadow: 'var(--surface-shadow-raised)',
  color: 'var(--text-primary)',
  fontSize: '12px',
};

export function FinancialCharts({ dreData, categoryData, onAddExpense }: FinancialChartsProps) {
  return (
    <>
      {/* DRE — Resultado Operacional */}
      <PageSection tone="surface" density="compact" title="Resultado operacional">
        {dreData.length === 0 ? (
          <EmptyState
            tone="strong"
            icon={<BarChart3 className="h-5 w-5" />}
            title="Sem lancamentos no periodo."
            description="Registre receitas ou despesas para formar o historico financeiro deste imovel."
            actions={<Button onClick={onAddExpense}>Adicionar lancamento</Button>}
          />
        ) : (
          <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3 sm:p-4">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dreData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
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
                    formatter={(value) => (
                      <span className="text-xs capitalize text-text-secondary">{value}</span>
                    )}
                  />
                  <Bar dataKey="despesas" fill="var(--text-danger)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="receitas" fill="var(--text-success)" radius={[6, 6, 0, 0]} />
                  <Line
                    dataKey="saldo"
                    stroke="var(--interactive-primary-bg)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </PageSection>

      {/* PIE — Composição de Despesas */}
      <PageSection tone="surface" density="compact" title="Composição de despesas">
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
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value)]}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-2">
              {categoryData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-strong)] px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: entry.color }}
                    />
                    <span className="truncate text-sm text-text-secondary">{entry.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-text-primary">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageSection>
    </>
  );
}

import { qs, request } from '@/lib/api/_core';
import type { CursorPage, Property } from '@/lib/api/_core';
import type { ExpenseCategory } from '@houselog/contracts';

export type { ExpenseCategory };

export type Expense = {
  id: string;
  property_id: string;
  type: 'expense' | 'revenue';
  category: ExpenseCategory;
  amount: number;
  reference_month: string;
  receipt_url: string | null;
  notes: string | null;
  is_recurring: number;
  recurrence_group: string | null;
  created_by: string;
  created_at: string;
};

export type ExpenseSummary = {
  total: number;
  total_revenue: number;
  by_category: { category: string; total: number; count: number }[];
  by_month: { reference_month: string; total: number; count: number }[];
  by_month_revenue: { reference_month: string; total: number }[];
  period: { from: string; to: string };
};

export type HealthScoreReport = {
  score: number;
  label: string;
  breakdown: {
    maintenance_compliance: number;
    service_backlog: number;
    preventive_ratio: number;
    age_penalty: number;
    document_completeness: number;
  };
};

export type ValuationPayload = {
  property: Property;
  expenses_total: number;
  services_total: number;
  maintenance_total: number;
  health_score: number;
  health_label: string;
  health_breakdown: Record<string, number>;
  services_summary: { status: string; count: number }[];
  inventory_items: number;
  recent_services: { title: string; system_type: string; status: string; completed_at: string | null; cost: number | null }[];
  generated_at: string;
};

export const expensesApi = {
  list: (propertyId: string, params?: { month?: string; category?: string; cursor?: string }) =>
    request<CursorPage<Expense>>(
      `/properties/${propertyId}/expenses${qs(params)}`
    ),

  summary: (propertyId: string, params?: { from?: string; to?: string }) =>
    request<ExpenseSummary>(
      `/properties/${propertyId}/expenses/summary${qs(params)}`
    ),

  create: (propertyId: string, data: Partial<Expense>) =>
    request<{ expense: Expense }>(`/properties/${propertyId}/expenses`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  update: (propertyId: string, id: string, data: Partial<Expense>) =>
    request<{ expense: Expense }>(`/properties/${propertyId}/expenses/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  delete: (propertyId: string, id: string) =>
    request<{ success: boolean }>(`/properties/${propertyId}/expenses/${id}`, { method: 'DELETE' }),
};

export const reportsApi = {
  healthScore: (propertyId: string) =>
    request<HealthScoreReport>(`/properties/${propertyId}/report/health-score`),

  valuationPdf: (propertyId: string) =>
    request<ValuationPayload>(`/properties/${propertyId}/report/valuation-pdf`),
};

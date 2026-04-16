import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
}

export function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(d);
}

export function scoreColor(score: number): string {
  if (score < 30) return 'text-rose-500';
  if (score < 60) return 'text-amber-500';
  if (score < 80) return 'text-emerald-500';
  return 'text-primary-600';
}

export function scoreBg(score: number): string {
  if (score < 30) return 'bg-rose-500';
  if (score < 60) return 'bg-amber-500';
  if (score < 80) return 'bg-emerald-500';
  return 'bg-primary-500';
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: 'Casa',
  apt: 'Apartamento',
  commercial: 'Comercial',
  warehouse: 'Galpão',
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  approved: 'Aprovada',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  verified: 'Verificada',
};

export const SERVICE_PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  normal: 'Normal',
  preventive: 'Preventiva',
};

export const SYSTEM_TYPE_LABELS: Record<string, string> = {
  electrical: 'Elétrica',
  plumbing: 'Hidráulica',
  structural: 'Estrutural',
  waterproofing: 'Impermeabilização',
  painting: 'Pintura',
  flooring: 'Piso',
  roofing: 'Telhado',
  general: 'Geral',
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  water: 'Água',
  electricity: 'Energia',
  gas: 'Gás',
  condo: 'Condomínio',
  iptu: 'IPTU',
  insurance: 'Seguro',
  cleaning: 'Limpeza',
  garden: 'Jardim',
  security: 'Segurança',
  other: 'Outros',
};

export const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  paint: 'Tinta',
  tile: 'Piso/Revestimento',
  waterproof: 'Impermeabilizante',
  plumbing: 'Hidráulica',
  electrical: 'Elétrica',
  hardware: 'Ferragem',
  adhesive: 'Adesivo',
  sealant: 'Selante',
  other: 'Outros',
};

export const ROOM_TYPE_LABELS: Record<string, string> = {
  bedroom: 'Quarto',
  bathroom: 'Banheiro',
  kitchen: 'Cozinha',
  living: 'Sala',
  garage: 'Garagem',
  laundry: 'Lavanderia',
  external: 'Área Externa',
  roof: 'Telhado/Cobertura',
  other: 'Outro',
};

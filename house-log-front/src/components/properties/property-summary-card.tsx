import type * as React from 'react';
import { Building2, Calendar, Clock, FileText, Ruler } from 'lucide-react';
import { type Property } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { propertySummaryCardVariants, propertySummaryItemVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

type PropertySummaryCardProps = {
  property: Property;
  className?: string;
};

type SummaryItemProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
};

function SummaryItem({ icon: Icon, label, value }: SummaryItemProps) {
  return (
    <div className={propertySummaryItemVariants()}>
      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-2 min-w-0 text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}

export function PropertySummaryCard({ property, className }: PropertySummaryCardProps) {
  return (
    <section className={cn(propertySummaryCardVariants({ density: 'comfortable' }), className)}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-medium text-text-primary">Resumo tecnico</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Dados-base do prontuario para orientar manutencao, documentos, garantias e governanca operacional.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {property.area_m2 && <SummaryItem icon={Ruler} label="Area tecnica" value={`${property.area_m2} m2`} />}
        {property.year_built && <SummaryItem icon={Calendar} label="Ano base" value={property.year_built} />}
        <SummaryItem icon={Building2} label="Pavimentos" value={property.floors} />
        {property.structure && <SummaryItem icon={Building2} label="Estrutura" value={property.structure} />}
        <SummaryItem icon={Clock} label="Registro HouseLog" value={formatDate(property.created_at)} />
      </dl>
    </section>
  );
}

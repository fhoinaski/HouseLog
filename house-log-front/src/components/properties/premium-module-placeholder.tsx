import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

type PremiumModulePlaceholderProps = {
  propertyId: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  premiumRole: string;
  technicalTodo: string;
  plannedItems: string[];
};

export function PremiumModulePlaceholder({
  propertyId,
  eyebrow,
  title,
  description,
  icon: Icon,
  premiumRole,
  technicalTodo,
  plannedItems,
}: PremiumModulePlaceholderProps) {
  return (
    <div className="mx-auto max-w-[980px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <Button asChild variant="outline">
            <Link href={`/properties/${propertyId}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao imovel
            </Link>
          </Button>
        }
      />

      <PageSection
        title="Camada premium do prontuario"
        description={premiumRole}
        tone="strong"
        density="editorial"
      >
        <EmptyState
          icon={<Icon className="h-6 w-6" aria-hidden="true" />}
          title={`${title} ainda nao possui dados estruturados`}
          description="A interface esta preparada para receber o contrato definitivo sem simular dados, payloads ou endpoints."
          actions={
            <Button variant="outline" disabled title={technicalTodo}>
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              TODO tecnico documentado
            </Button>
          }
          tone="subtle"
          density="spacious"
        />
      </PageSection>

      <PageSection
        title="Proximo contrato esperado"
        description={technicalTodo}
        tone="surface"
        density="compact"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {plannedItems.map((item) => (
            <div
              key={item}
              className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface-muted px-3 py-3 text-sm leading-6 text-hl-text-muted"
            >
              {item}
            </div>
          ))}
        </div>
      </PageSection>
    </div>
  );
}

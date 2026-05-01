import { FolderKanban } from 'lucide-react';
import { PremiumModulePlaceholder } from '@/components/properties/premium-module-placeholder';

export default async function PropertyRenovationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PremiumModulePlaceholder
      propertyId={id}
      eyebrow="Intervencoes relevantes"
      title="Reformas"
      description="Registro de reformas, obras e intervencoes que alteram a memoria tecnica do imovel."
      icon={FolderKanban}
      premiumRole="Reformas agrupam escopo, evidencias, custos, documentos, prestadores e sistemas afetados para preservar a rastreabilidade patrimonial."
      technicalTodo="TODO: implementar entidade renovations e seus vinculos com documentos, fotos, garantias e service_orders."
      plannedItems={[
        'Registrar periodo, escopo, responsaveis e status da reforma.',
        'Anexar fotos antes/depois, contratos, notas e projetos atualizados.',
        'Relacionar sistemas impactados e garantias geradas.',
        'Publicar eventos consolidados na timeline tecnica do imovel.',
      ]}
    />
  );
}

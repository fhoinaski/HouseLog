import { Map } from 'lucide-react';
import { PremiumModulePlaceholder } from '@/components/properties/premium-module-placeholder';

export default async function PropertyMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PremiumModulePlaceholder
      propertyId={id}
      eyebrow="Mapa tecnico"
      title="Mapa"
      description="Plantas, pontos tecnicos e localizacao de sistemas sensiveis do imovel."
      icon={Map}
      premiumRole="O mapa tecnico sera a camada visual para localizar registros, quadros, shafts, sensores, tubulacoes, drenagens e pontos de inspecao."
      technicalTodo="TODO: implementar entidades technical_points e technical_photos com isolamento por tenantId/propertyId antes de carregar dados reais."
      plannedItems={[
        'Selecionar planta ou foto de referencia do pavimento.',
        'Posicionar pontos tecnicos com coordenadas relativas.',
        'Filtrar pontos por sistema, ambiente, criticidade e historico.',
        'Controlar acesso porque o mapa revela infraestrutura sensivel.',
      ]}
    />
  );
}

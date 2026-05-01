import { Layers3 } from 'lucide-react';
import { PremiumModulePlaceholder } from '@/components/properties/premium-module-placeholder';

export default async function PropertySystemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PremiumModulePlaceholder
      propertyId={id}
      eyebrow="Sistemas tecnicos"
      title="Sistemas"
      description="Organizacao dos sistemas eletrico, hidraulico, automacao, impermeabilizacao, climatizacao e seguranca."
      icon={Layers3}
      premiumRole="Sistemas transformam o prontuario do imovel em uma leitura tecnica por infraestrutura, conectando documentos, garantias, pontos e servicos."
      technicalTodo="TODO: criar contrato de leitura para technical_systems antes de exibir sistemas persistidos."
      plannedItems={[
        'Cadastrar sistemas por tipo, localizacao resumida e status operacional.',
        'Conectar sistemas a documentos, garantias, OS e pontos tecnicos.',
        'Exibir ultima inspecao e responsavel tecnico quando houver.',
        'Aplicar tenantId/propertyId em toda consulta sensivel.',
      ]}
    />
  );
}

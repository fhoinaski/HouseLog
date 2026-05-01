import { ShieldCheck } from 'lucide-react';
import { PremiumModulePlaceholder } from '@/components/properties/premium-module-placeholder';

export default async function PropertyWarrantiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PremiumModulePlaceholder
      propertyId={id}
      eyebrow="Garantias"
      title="Garantias"
      description="Controle de garantias de sistemas, materiais, equipamentos, servicos e reformas."
      icon={ShieldCheck}
      premiumRole="Garantias protegem valor patrimonial e reduzem perda de prazo, conectando comprovantes, fornecedores, sistemas e historico de atendimento."
      technicalTodo="TODO: criar contrato warranties com tenantId/propertyId antes de listar garantias reais."
      plannedItems={[
        'Registrar inicio, vencimento, fornecedor, termos e status.',
        'Vincular garantia a documentos, sistemas, pontos, OS ou reformas.',
        'Gerar alertas antes do vencimento.',
        'Manter garantias vencidas no historico tecnico.',
      ]}
    />
  );
}

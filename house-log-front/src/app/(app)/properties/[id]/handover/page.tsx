import { PropertyHandoverReadonly } from '@/components/properties/premium-readonly-sections';

export default async function PropertyHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PropertyHandoverReadonly propertyId={id} />;
}

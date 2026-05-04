import { PropertyRenovationsReadonly } from '@/components/properties/premium-readonly-sections';

export default async function PropertyRenovationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PropertyRenovationsReadonly propertyId={id} />;
}
